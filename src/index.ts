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
     * AWS secret name containing the New Relic and Pixie keys in AWS Secrets Manager.
     * Define secret in JSON format with the following keys:
     * {
     *  "nrLicenseKey": "<your New Relic license key>",
     *  "pixieDeployKey": "<your Pixie deploy key>",
     *  "pixieApiKey": "<your Pixie api key>"
     * }
     *
     * Keys can be obtained in the New Relic Guided Install for Kubernetes
     */
    awsSecretName?: string;

    /**
     * Kubernetes cluster name in New Relic
     */
    newRelicClusterName?: string;

    /**
     * Pixie Api Key - can be obtained in New Relic's Guided Install for Kubernetes - Plaintext
     */
    pixieApiKey?: string;

    /**
     * Pixie Deploy Key - can be obtained in New Relic's Guided Install for Kubernetes - Plaintext
     */
    pixieDeployKey?: string;

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
        const values = { ...props.values ?? {}};

        let nrSecretPod : Construct | undefined;

        const ns = ssp.utils.createNamespace(this.props.namespace, clusterInfo.cluster, true);

        // Let's catch some configuration errors early if we can.
        try {
            if((props.pixieApiKey && props.awsSecretName) ||
            (props.pixieDeployKey && props.awsSecretName) ||
            (props.newRelicLicenseKey && props.awsSecretName)) {
                throw "You must supply an AWS Secrets Manager secret name (awsSecretName) **OR** New Relic and Pixie keys directly. You cannot combine both. Please check your configuration."
            }

            if (!props.newRelicClusterName) {
                throw "You must set a New Relic Cluster name.  Please check your configuration."
            }
        } catch (err) {
            throw err;
        }

        if (props.newRelicClusterName && props.newRelicLicenseKey) {
            setPath(values, "global.cluster", props.newRelicClusterName)
            setPath(values, "global.licenseKey", props.newRelicLicenseKey);
            this.installPixie(props, values);
        } else if (props.awsSecretName) {

            const sa = clusterInfo.cluster.addServiceAccount("new-relic-secret-sa", {
                name: "new-relic-secret-sa",
                namespace: this.props.namespace
            });

            sa.node.addDependency(ns);

            // Create New Relic secret provider class
            // https://secrets-store-csi-driver.sigs.k8s.io/
            const nrSecretProviderClass = this.nrSetupSecretProviderClass(clusterInfo, sa);

            // New Relic secret pod
            nrSecretPod = cluster.addManifest("nr-secret-pod",
                this.nrCreateSecretPodManifest("busybox", sa, "nr-secret-class"));

            nrSecretProviderClass.addDependent(nrSecretPod);
            nrSecretPod.node.addDependency(sa);

            // Set cluster name, global custom secret name and key
            setPath(values, "global.cluster", props.newRelicClusterName)
            setPath(values, "global.customSecretName", "pl-deploy-secrets");
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

        if(nrSecretPod !== undefined) {
            newRelicHelmChart.node.addDependency(nrSecretPod);
        }

        return Promise.resolve(newRelicHelmChart);
    }

    /**
     * Sets Pixie install options
     * @param props
     * @param values
     */
    private installPixie(props: NewRelicAddOnProps, values: {[key: string]: any}) {

        // Installs Pixie into the cluster.
        // If pixieDeployKey is not set, assumes deploy key is in AWS Secrets Manager
        // and "unused" will be overwritten by secrets store
        if (props.installPixie) {
            setPath(values, "pixie-chart.enabled", "true");
            setPath(values, "pixie-chart.deployKey", props.pixieDeployKey ?? "unused");
            setPath(values, "pixie-chart.clusterName", props.newRelicClusterName);
        }

        if (props.installPixieIntegration && props.awsSecretName) {
            setPath(values, "newrelic-pixie.enabled", "true");
            // "pl-deploy-secrets" secret name must be hardcoded until Pixie allows custom secret names
            setPath(values, "newrelic-pixie.customSecretApiKeyName", "pl-deploy-secrets");
            setPath(values, "newrelic-pixie.customSecretApiKeyKey", "pixieApiKey");
        } else if (props.installPixieIntegration && props.pixieApiKey) {
            setPath(values, "newrelic-pixie.enabled", "true");
            setPath(values, "newrelic-pixie.apiKey", props.pixieApiKey);
        }
    }

    /**
     * Creates a secret provider class for the nri-bundle secret keys.
     * The secret provider class can then be mounted to pods and the secret is made available as the volume mount.
     * The CSI Secret Driver also creates a regular Kubernetes Secret once the secret volume is mounted. That secret
     * is available while at least one pod with the mounted secret volume exists.
     *
     * @param clusterInfo
     * @param serviceAccount
     * @returns SecretProviderClass
     */
     private nrSetupSecretProviderClass(clusterInfo: ssp.ClusterInfo, serviceAccount: ServiceAccount): ssp.SecretProviderClass {

        const csiSecret: ssp.addons.CsiSecretProps = {
            secretProvider: new ssp.LookupSecretsManagerSecretByName(this.options.awsSecretName!),
            jmesPath: [
                { path: "nrLicenseKey", objectAlias: "newrelic-license-key" },
                { path: "pixieApiKey", objectAlias: "pixie-api-key" },
                { path: "pixieDeployKey", objectAlias: "pixie-deploy-key" }
            ],
            kubernetesSecret: {
                secretName: "pl-deploy-secrets",
                data: [
                    { key: "licenseKey", objectName: "newrelic-license-key"},
                    { key: "pixieApiKey", objectName: "pixie-api-key"},
                    { key: "deploy-key", objectName: "pixie-deploy-key"}
                ]
            }
        };

       return new ssp.addons.SecretProviderClass(clusterInfo, serviceAccount, "nr-secret-class", csiSecret);
    }

    /**
     * Creates secret pod deployment manifest for New Relic (assuming busybox)
     * @param image assumes busy box, allows to lock on a version
     * @param sa
     * @param secretProviderClassName
     * @returns deployment
     */
    private nrCreateSecretPodManifest(image: string, sa: ServiceAccount, secretProviderClassName: string) {
        const name = "new-relic-secrets-pod";
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
                            },
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
}