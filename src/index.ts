import { ServiceAccount } from '@aws-cdk/aws-eks';
import { Construct } from '@aws-cdk/core';
import * as ssp from '@aws-quickstart/ssp-amazon-eks';

export interface NewRelicAddOnProps extends ssp.addons.HelmAddOnUserProps {
    /**
     * Namespace for the add-on.
     */
    namespace?: string;

    /**
     * New Relic License Key - Plaintext
     */
    newRelicLicenseKey?: string;

    /**
     * Secret Name containing the New Relic License Key in AWS Secrets Manager
     */
    nrLicenseKeySecretName?: string;

    /**
     * Kubernetes cluster name in New Relic
     */
    newRelicClusterName?: string;

    /**
     * Helm chart version
     */
    version?: string;

    /**
     * Helm chart repository.
     * Defaults to the official repo URL.
     */
    repository?: string;

    /**
     * Release name.
     * Defaults to 'newrelic-bundle'.
     */
    release?: string;

    /**
     * Chart name.
     * Defaults to 'nri-bundle'.
     */
    chart?: string;

    /**
     * Set to true to enable Low Data Mode (default: true)
     * See docs for more details: https://docs.newrelic.com/docs/kubernetes-pixie/kubernetes-integration/installation/install-kubernetes-integration-using-helm/#reducedataingest
     */
    lowDataMode?: boolean;

    /**
     * Set to true to install the New Relic Infrastructure Daemonset (default: true)
     */
    installInfrastructure?: boolean;

    /**
     * Set to true to install the New Relic Kubernetes Events integration (default: true)
     */
    installKubeEvents?: boolean;

    /**
     * Set to true to install the Kube State Metrics (default: true)
     */
    installKSM?: boolean;

    /**
     * Set to true to install the New Relic Fluent-Bit Logging integration (default: true)
     */
    installLogging?: boolean;

    /**
     * Set to true to install the New Relic Kubernetes Metrics Adapter (default: false)
     */
    installMetricsAdapter?: boolean;

    /**
     * Set to true to install New Relic Prometheus OpenMetrics Integration (default: true)
     */
    installPrometheus?: boolean;

    /**
     * Set to true to install Pixie (default: false)
     */
    installPixie?: boolean;

     /**
     * Set to true to install the Newrelic <-> Pixie integration pod (default: false)
     */
    installPixieIntegration?: boolean;

    /**
     * Pixie Api Key - can be obtained in New Relic's Guided Install for Kubernetes
     */
    pixieApiKey?: string;

    /**
     * Pixie Deploy Key - can be obtained in New Relic's Guided Install for Kubernetes
     */
    pixieDeployKey?: string;

    /**
     * ...
     */
    pixieDeployKeySecretName?: string;

    /**
     * Values to pass to the chart.
     * Config options: https://github.com/newrelic/helm-charts/tree/master/charts/nri-bundle#configuration
     */
    values?: {
        [key: string]: any;
    };
}

const defaultProps: ssp.addons.HelmAddOnProps & NewRelicAddOnProps = {
    name: "newrelic-ssp-addon",
    repository: "https://helm-charts.newrelic.com",
    chart: "nri-bundle",
    namespace: "newrelic",
    version: "3.4.0",
    release: "newrelic-bundle",
    lowDataMode: true,
    installInfrastructure: true,
    installKSM: true,
    installKubeEvents: true,
    installMetricsAdapter: false,
    installPrometheus: true,
    installLogging: true,
    installPixie: false,
    installPixieIntegration: false,
    values: {}
};

const setPath = ssp.utils.setPath;

export class NewRelicAddOn extends ssp.addons.HelmAddOn {

    readonly options: NewRelicAddOnProps;

    constructor(props?: NewRelicAddOnProps) {
        super({...defaultProps, ...props});
        this.options = { ...defaultProps, ...props };
    }

    async deploy(clusterInfo: ssp.ClusterInfo): Promise<Construct> {

        const props = this.options;
        const cluster = clusterInfo.cluster;

        let secretPod : Construct | undefined;
        const values = { ...props.values ?? {}};

        const ns = ssp.utils.createNamespace(this.props.namespace, clusterInfo.cluster, true);

        if (props.newRelicClusterName) {
            setPath(values, "global.cluster", props.newRelicClusterName)
        }

        if (props.newRelicLicenseKey && props.pixieDeployKey && props.pixieApiKey) {
            setPath(values, "global.licenseKey", props.newRelicLicenseKey);

            this.installPixie(props, values);
        }
        else if (props.nrLicenseKeySecretName && props.pixieDeployKeySecretName) {

            const sa = clusterInfo.cluster.addServiceAccount("new-relic-secret-sa", {
                name: "new-relic-secret-sa",
                namespace: this.props.namespace
            });

            const sb = clusterInfo.cluster.addServiceAccount("pixie-secret-sa", {
                name: "pixie-secret-sa",
                namespace: this.props.namespace
            });

            sa.node.addDependency(ns);
            sb.node.addDependency(ns);

            // New Relic Secret Provider Class (Infra, NR+Pixie integration)
            const secretProviderClass = this.setupSecretProviderClass(clusterInfo, sa);

            // Pixie Secret Provider Class (Pixie Deployment)
            const pixieSecretProviderClass = this.setupPixieSecretProviderClass(clusterInfo, sb);

            const nrSecretPod = cluster.addManifest("nr-secret-pod",
                this.createSecretPodManifest("busybox", sa, "nr-license-secret-class"));

            const pixieSecretPod = cluster.addManifest("pixie-secret-pod",
            this.pixieCreateSecretPodManifest("busybox", sb, "pixie-deploykey-secret-class"));

            secretProviderClass.addDependent(nrSecretPod);
            pixieSecretProviderClass.addDependent(pixieSecretPod);
            nrSecretPod.node.addDependency(sa);
            pixieSecretPod.node.addDependency(sb);

            // Global custom secret names
            setPath(values, "global.customSecretName", props.release + "-nrk8s-license-custom");
            setPath(values, "global.customSecretLicenseKey", "licenseKey");

            this.installPixie(props, values);
        }

        if (props.lowDataMode) {
            setPath(values, "global.lowDataMode", props.lowDataMode)
        }

        if (props.installPrometheus) {
            setPath(values, "prometheus", props.installPrometheus)
        }

        if (props.installLogging) {
            setPath(values, "logging", props.installLogging)
        }

        if (props.installInfrastructure) {
            setPath(values, "infrastructure.enabled", props.installInfrastructure);
        }

        if (props.installKSM) {
            setPath(values, "ksm.enabled", props.installKSM);
        }

        if (props.installKubeEvents) {
            setPath(values, "kubeEvents.enabled", props.installKubeEvents);
        }

        if (props.installMetricsAdapter) {
            setPath(values, "metrics-adapter.enabled", props.installMetricsAdapter);
        }

        const newRelicHelmChart = clusterInfo.cluster.addHelmChart("newrelic-bundle", {
            chart: props.chart ? props.chart : "nri-bundle",
            release: props.release,
            repository: props.repository,
            namespace: props.namespace,
            version: props.version,
            values
        });

        if(secretPod) {
            newRelicHelmChart.node.addDependency(secretPod);
        }

        return Promise.resolve(newRelicHelmChart);
    }

    /**
     *  TO BE COMPLETED: Sets Pixie install options
     * @param props
     * @param values
     */
    private installPixie(props: NewRelicAddOnProps, values: {[key: string]: any}) {

        if (props.installPixie) {
            setPath(values, "pixie-chart.enabled", "true");
            setPath(values, "pixie-chart.deployKey", props.pixieDeployKey);
            setPath(values, "pixie-chart.clusterName", props.newRelicClusterName);
        }

        if (props.installPixieIntegration && props.nrLicenseKeySecretName) {
            setPath(values, "newrelic-pixie.enabled", "true");
            setPath(values, "newrelic-pixie.customSecretApiKeyName", props.release + "-nrk8s-license-custom");
            setPath(values, "newrelic-pixie.customSecretApiKeyKey", "pixieApiKey");
        } else if (props.installPixieIntegration && props.pixieApiKey) {
            setPath(values, "newrelic-pixie.enabled", "true");
            setPath(values, "newrelic-pixie.apiKey", props.pixieApiKey);
        }
    }

    /**
     * Creates a secret provider class for the specified secret key (licenseKey).
     * The secret provider class can then be mounted to pods and the secret is made available as the volume mount.
     * The CSI Secret Driver also creates a regular Kubernetes Secret once the secret volume is mounted. That secret
     * is available while at least one pod with the mounted secret volume exists.
     *
     * @param clusterInfo
     * @param serviceAccount
     * @returns
     */
     private setupSecretProviderClass(clusterInfo: ssp.ClusterInfo, serviceAccount: ServiceAccount): ssp.SecretProviderClass {

        const csiSecret: ssp.addons.CsiSecretProps = {
            secretProvider: new ssp.LookupSecretsManagerSecretByName(this.options.nrLicenseKeySecretName!),
            jmesPath: [
                { path: "nrLicenseKey", objectAlias: "newrelic-license-key" },
                { path: "pixieApiKey", objectAlias: "pixie-api-key" }
            ],
            kubernetesSecret: {
                secretName: "newrelic-bundle-nrk8s-license-custom",
                data: [
                    { key: "licenseKey", objectName: "newrelic-license-key"},
                    { key: "pixieApiKey", objectName: "pixie-api-key"}
                ]
            }
        };

       return new ssp.addons.SecretProviderClass(clusterInfo, serviceAccount, "nr-license-secret-class", csiSecret);
    }

    /**
     * Creates a secret provider class for the specified secret key (licenseKey).
     * The secret provider class can then be mounted to pods and the secret is made available as the volume mount.
     * The CSI Secret Driver also creates a regular Kubernetes Secret once the secret volume is mounted. That secret
     * is available while at least one pod with the mounted secret volume exists.
     *
     * @param clusterInfo
     * @param serviceAccount
     * @returns
     */
     private setupPixieSecretProviderClass(clusterInfo: ssp.ClusterInfo, serviceAccount: ServiceAccount): ssp.SecretProviderClass {
        const csiSecret: ssp.addons.CsiSecretProps = {
            secretProvider: new ssp.LookupSecretsManagerSecretByName(this.options.pixieDeployKeySecretName!),
            jmesPath: [
                { path: "pixieDeployKey", objectAlias: "pixieDeployKey" }
            ],
            kubernetesSecret: {
                secretName: "pl-deploy-secrets",
                data: [
                    { key: "deploy-key", objectName: "pixieDeployKey"}
                ]
            }
        };

       return new ssp.addons.SecretProviderClass(clusterInfo, serviceAccount, "pixie-deploykey-secret-class", csiSecret);
    }

    /**
     * Creates secret pod deployment manifest (assuming busybox)
     * @param image  assumes busy box, allows to lock on a version
     * @param sa
     * @param secretProviderClassName
     * @returns
     */
    private createSecretPodManifest(image: string, sa: ServiceAccount, secretProviderClassName: string) {
        const name = "new-relic-secret-pod";
        const deployment = {
            apiVersion: "apps/v1",
            kind: "Deployment",
            metadata: {
                name: name,
                namespace: sa.serviceAccountNamespace,
            },
            spec: {
                replicas: 1,
                selector: { matchLabels: { name }},
                template: {
                    metadata: { labels: { name }},
                    spec: {
                        serviceAccountName: sa.serviceAccountName,
                        containers: [
                            {
                                name,
                                image: image,
                                command: ['sh', '-c', 'while :; do sleep 2073600; done'],
                                volumeMounts: [{
                                    name: "secrets-store",
                                    mountPath: "/mnt/secrets-store",
                                    readOnly: true,
                                }
                            ]
                            }
                        ],
                        volumes: [{
                            name: "secrets-store",
                            csi: {
                                driver: "secrets-store.csi.k8s.io",
                                readOnly: true,
                                volumeAttributes: {
                                    secretProviderClass: secretProviderClassName
                                }
                            }
                        }
                    ],
                    }
                }
            }
        };
        return deployment;
    }

    /**
     * Creates secret pod deployment manifest (assuming busybox)
     * @param image  assumes busy box, allows to lock on a version
     * @param sa
     * @param secretProviderClassName
     * @returns
     */
     private pixieCreateSecretPodManifest(image: string, sb: ServiceAccount, pixieSecretProviderClassName: string) {
        const name = "pixie-secret-pod";
        const deployment = {
            apiVersion: "apps/v1",
            kind: "Deployment",
            metadata: {
                name: name,
                namespace: sb.serviceAccountNamespace,
            },
            spec: {
                replicas: 1,
                selector: { matchLabels: { name }},
                template: {
                    metadata: { labels: { name }},
                    spec: {
                        serviceAccountName: sb.serviceAccountName,
                        containers: [
                            {
                                name,
                                image: image,
                                command: ['sh', '-c', 'while :; do sleep 2073600; done'],
                                volumeMounts: [
                                {
                                    name: "pixie-secrets-store",
                                    mountPath: "/mnt/pixie-secrets-store",
                                    readOnly: true,
                                }
                            ]
                            }
                        ],
                        volumes: [
                        {
                            name: "pixie-secrets-store",
                            csi: {
                                driver: "secrets-store.csi.k8s.io",
                                readOnly: true,
                                volumeAttributes: {
                                    secretProviderClass: pixieSecretProviderClassName
                                }
                            }
                        }
                    ],
                    }
                }
            }
        };
        return deployment;
    }
}