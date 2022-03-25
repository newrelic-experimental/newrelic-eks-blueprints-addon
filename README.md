[![New Relic Experimental header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Experimental.png)](https://opensource.newrelic.com/oss-category/#new-relic-experimental)

# New Relic Addon - AWS EKS Blueprints for CDK

This repository contains the source code for the New Relic AddOn for AWS EKS Blueprints. EKS Blueprints is a [CDK](https://aws.amazon.com/cdk/) construct that makes it easy for customers to configure and deploy New Relic's Kubernetes integration as part of a EKS Blueprint cluster on [Amazon EKS](https://aws.amazon.com/eks/).

## Installation

Using [npm](https://npmjs.org):

```bash
npm install @newrelic/newrelic-blueprints-addon
```

For a quick tutorial on EKS Blueprints, visit the [Getting Started guide](https://aws-quickstart.github.io/cdk-eks-blueprints/getting-started/).

## Usage

```
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
    }))
    .region(process.env.AWS_REGION)
    .account(process.env.AWS_ACCOUNT)
    .build(app, 'demo-cluster');
```
| Variable                | Type                   | Required | Description                                                                                                                                                                                                                                                                                                                                                                                        |
|-------------------------|------------------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| newRelicLicenseKey      | string                 | True     | New Relic License Key (plain text). Use `awsSecretName` instead for AWS Secrets Manager support and added security.                                                                                                                                                                                                                                                                     |
| awsSecretName           | string                 | True     | AWS Secret name containing the New Relic and Pixie keys in AWS Secrets Manager. Define secret in JSON format with the following keys:  ``` {   "nrLicenseKey": "REPLACE WITH YOUR NEW RELIC LICENSE KEY",   "pixieDeployKey": "REPLACE WITH YOUR PIXIE LICENSE KEY",   "pixieApiKey": "REPLACE WITH YOUR PIXIE API KEY" } ```  Keys can be obtained in the New Relic Guided Install for Kubernetes |
| newRelicClusterName     | string                 | True     | Name for the cluster in the New Relic UI.                                                                                                                                                                                                                                                                                                                                                          |
| pixieApiKey             | string                 |          | Pixie Api Key can be obtained in New Relic's Guided Install for Kubernetes (plaintext).  Use `awsSecretName` instead for AWS Secrets Manager support and added security.                                                                                                                                                                                                                                                                                                              |
| pixieDeployKey          | string                 |          | Pixie Deploy Key can be obtained in New Relic's Guided Install for Kubernetes -  (plaintext).  Use `awsSecretName` instead for AWS Secrets Manager support and added security.                                                                                                                                                                                                                                                                                                          |
| namespace               | string                 |          | The namespace where New Relic components will be installed. Defaults to  `newrelic`.                                                                                                                                                                                                                                                                                                               |
| lowDataMode             | boolean                |          | Default  `true`.  Set to  `false`  to disable  `lowDataMode` .  For more details, visit https://docs.newrelic.com/docs/kubernetes-pixie/kubernetes-integration/installation/install-kubernetes-integration-using-helm/#reducedataingest                                                                                                                                                            |
| installInfrastructure   | boolean                |          | Default  `true` .  Set to  `false`  to disable installation of the New Relic Infrastructure Daemonset.                                                                                                                                                                                                                                                                                             |
| installKSM              | boolean                |          | Default  `true` .  Set to  `false`  to disable installation of Kube State Metrics.  An instance of KSM is required in the cluster for the New Relic Infrastructure Daemonset to function properly.                                                                                                                                                                                                 |
| installKubeEvents       | boolean                |          | Default  `true` .  Set to  `false`  to disable installation of the New Relic Kubernetes Events integration.                                                                                                                                                                                                                                                                                        |
| installLogging          | boolean                |          | Default  `true` .  Set to  `false`  to disable installation of the New Relic Logging (Fluent-Bit) Daemonset.                                                                                                                                                                                                                                                                                       |
| installMetricsAdapter   | boolean                |          | Default  `false` .  Set to  `true`  to enable installation of the New Relic Kubernetes Metrics Adapter.                                                                                                                                                                                                                                                                                            |
| installPrometheus       | boolean                |          | Default  `true` .  Set to  `false`  to disable installation of the Prometheus OpenMetrics Integration.                                                                                                                                                                                                                                                                                             |
| installPixie            | boolean                |          | Default  `false` .  Set to  `true`  to enable installation Pixie into the cluster.                                                                                                                                                                                                                                                                                                                 |
| installPixieIntegration | boolean                |          | Default   `false`  .  Set to   `true`   to enable installation the New Relic <-> Pixie integration pod into the cluster.                                                                                                                                                                                                                                                                           |
| version                 | string                 |          | Helm chart version.                                                                                                                                                                                                                                                                                                                                                                                |
| repository              | string                 |          | Additional options for customers who may need to supply their own private Helm repository.                                                                                                                                                                                                                                                                                                         |
| release                 | string                 |          | Additional options for customers who may need to supply their own private Helm repository.                                                                                                                                                                                                                                                                                                         |
| chart                   | string                 |          | Additional options for customers who may need to supply their own private Helm repository.                                                                                                                                                                                                                                                                                                         |
| values                  | { [key: string]: any } |          | Custom values to pass to the chart. Config options: https://github.com/newrelic/helm-charts/tree/master/charts/nri-bundle#configuration                                                                                                                                                                                                                                                            |

## Support

New Relic hosts and moderates an online forum where customers can interact with New Relic employees as well as other customers to get help and share best practices.

https://discuss.newrelic.com/

## Contributing
We encourage your contributions to improve the New Relic Addon for EKS Blueprints! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.
If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company,  please drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](https://github.com/newrelic-experimental/newrelic-ssp-addon/security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

## License
The New Relic Addon for EKS Blueprints is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.
