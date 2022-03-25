import * as cdk from 'aws-cdk-lib';
import * as ssp from '@aws-quickstart/eks-blueprints';
import { NewRelicAddOn } from '@newrelic/newrelic-blueprints-addon';

const app = new cdk.App();

ssp.EksBlueprint.builder()
    .addOns(new ssp.MetricsServerAddOn)
    .addOns(new ssp.ClusterAutoScalerAddOn)
    .addOns(new ssp.addons.SSMAgentAddOn)
    .addOns(new ssp.addons.SecretsStoreAddOn)
    .addOns(new NewRelicAddOn({
        version: "4.2.0-beta",
        newRelicClusterName: "demo-cluster",
        awsSecretName: "newrelic-pixie-combined", // Secret Name in AWS Secrets Manager
        installPixie: true,
        installPixieIntegration: true,
        /**
         * Examples:
         * nri-prometheus: configuring metric exclusions
         * newrelic-infrastructure: enabling cluster node process metrics
         */
        values: {
            "nri-prometheus": {
               "config": {
                  "transformations": [
                     {
                        "description": "Prometheus metric exclusion example",
                        "ignore_metrics": [
                           {
                              "prefixes": [
                                 "kube_"
                              ]
                           }
                        ]
                     }
                  ]
               }
            },
            "newrelic-infrastructure": {
               "common": {
                  "agentConfig": {
                     "enable_process_metrics": true
                  }
               }
            }
         }
    }))
    .region(process.env.AWS_REGION)
    .account(process.env.AWS_ACCOUNT)
    .build(app, 'demo-cluster');