import { ServiceAccount } from '@aws-cdk/aws-eks';
import { Construct } from '@aws-cdk/core';
import * as ssp from '@aws-quickstart/ssp-amazon-eks';
import * as yaml from 'js-yaml';
import request from 'then-request';

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
     * Just testing for now...
     */
     installPixie?: boolean;

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
            ssp.utils.setPath(values, "global.cluster", props.newRelicClusterName)
        }

        if (props.newRelicLicenseKey) {
            ssp.utils.setPath(values, "global.licenseKey", props.newRelicLicenseKey);
        }
        else if (props.nrLicenseKeySecretName) {
            const sa = clusterInfo.cluster.addServiceAccount("new-relic-secret-sa", {
                name: "new-relic-secret-sa",
                namespace: this.props.namespace
            });
            sa.node.addDependency(ns);
            const secretProviderClass = this.setupSecretProviderClass(clusterInfo, sa);
            const secretPod = cluster.addManifest("nr-secret-pod",
                this.createSecretPodManifest("busybox", sa, "nr-license-secret-class"));
            secretProviderClass.addDependent(secretPod);
            secretPod.node.addDependency(sa);
            setPath(values, "global.customSecretName", props.nrLicenseKeySecretName);
            setPath(values, "global.customSecretLicenseKey", "license");
        }

        if (props.lowDataMode) {
            ssp.utils.setPath(values, "global.lowDataMode", props.lowDataMode)
        }

        if(props.installPixie) {
            this.deployPixieCRDs(clusterInfo)
        }

        if (props.installPrometheus) {
            ssp.utils.setPath(values, "prometheus", props.installPrometheus)
        }

        if (props.installLogging) {
            ssp.utils.setPath(values, "logging", props.installLogging)
        }

        if (props.installInfrastructure) {
            ssp.utils.setPath(values, "infrastructure.enabled", props.installInfrastructure);
        }

        if (props.installKSM) {
            ssp.utils.setPath(values, "ksm.enabled", props.installKSM);
        }

        if (props.installKubeEvents) {
            ssp.utils.setPath(values, "kubeEvents.enabled", props.installKubeEvents);
        }

        if (props.installMetricsAdapter) {
            ssp.utils.setPath(values, "metrics-adapter.enabled", props.installMetricsAdapter);
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

    private async deployPixieCRDs(clusterInfo: ssp.ClusterInfo) {

        // const devViziersUrl = 'https://download.newrelic.com/install/kubernetes/pixie/latest/px.dev_viziers.yaml';
        // const olmCrdUrl = 'https://download.newrelic.com/install/kubernetes/pixie/latest/olm_crd.yaml';

        //const manifest =  yaml.loadAll(request('GET', devViziersUrl).getBody());

        const manifestUrl = 'https://download.newrelic.com/install/kubernetes/pixie/latest/px.dev_viziers.yaml';
        const result = await request('GET', manifestUrl).getBody()

        const manifest = yaml.loadAll(result.toString());
        clusterInfo.cluster.addManifest('pixie-crd', manifest);

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
            kubernetesSecret: {
                secretName: this.options.nrLicenseKeySecretName!,
                data: [
                    {
                        key: 'license'
                    }
                ]
            }
        };

       return new ssp.addons.SecretProviderClass(clusterInfo, serviceAccount, "nr-license-secret-class", csiSecret);
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
                                }]
                            }
                        ],
                        volumes: [{
                            name: "secrets-store",
                            csi: {
                                driver: "secrets-store.csi.k8s.io",
                                readOnly: true,
                                volumeAttributes: {
                                    secretProviderClass: secretProviderClassName,
                                }
                            }
                        }],
                    }
                }
            }
        };
        return deployment;
    }
}
