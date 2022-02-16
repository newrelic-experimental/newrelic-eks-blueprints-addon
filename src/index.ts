import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { Construct } from '@aws-cdk/core';
import { ServiceAccount } from '@aws-cdk/aws-eks';
import * as ssp from '@aws-quickstart/ssp-amazon-eks';

export interface NewRelicAddOnProps extends ssp.addons.HelmAddOnUserProps {
    /**
     * Namespace for the add-on.
     */
    namespace?: string;

    /**
     * New Relic License Key
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
    version: "3.2.11",
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


export class NewRelicAddOn extends ssp.addons.HelmAddOn {

    readonly options: NewRelicAddOnProps;

    constructor(props?: NewRelicAddOnProps) {
        super({...defaultProps, ...props});
        this.options = { ...defaultProps, ...props };
    }

    // async getNRLicenseKeyFromSecret(secretName: string, region: string) {
    //     const client = new SecretsManager({ region: region });
    //     let secretObject: any = {};

    //     try {
    //         let response = await client.getSecretValue({ SecretId: secretName }).promise();
    //         if (response) {
    //             if (response.SecretString) {
    //                 secretObject = JSON.parse(response.SecretString);
    //             } else if (response.SecretBinary) {
    //                 secretObject = JSON.parse(response.SecretBinary.toString());
    //             }
    //         }
    //     } catch (error) {
    //         console.log(error);
    //         throw error;
    //     }
    //     return secretObject;
    // }

    async deploy(clusterInfo: ssp.ClusterInfo): Promise<Construct> {

        const props = this.options;

        const values = { ...props.values ?? {}};

        if (props.newRelicClusterName) {
            ssp.utils.setPath(values, "global.cluster", props.newRelicClusterName)
        }

        if (props.newRelicLicenseKey) {
            ssp.utils.setPath(values, "global.licenseKey", props.newRelicLicenseKey);
        }
        // } else if (props.nrLicenseKeySecretName) {
        //     const response = await this.getNRLicenseKeyFromSecret(props.nrLicenseKeySecretName, clusterInfo.cluster.stack.region);
        //     ssp.utils.setPath(values, "global.licenseKey", response.license_key);
        // }

        if (props.lowDataMode) {
            ssp.utils.setPath(values, "global.lowDataMode", props.lowDataMode)
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
        return Promise.resolve(newRelicHelmChart);
    }
}
