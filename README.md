[![New Relic Experimental header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Experimental.png)](https://opensource.newrelic.com/oss-category/#new-relic-experimental)

# New Relic AddOn for AWS SSP CDK Platform

This repository contains the source code for the New Relic AddOn for AWS SSP CDK. `ssp-amazon-eks` is a [CDK](https://aws.amazon.com/cdk/) construct that makes it easy for customers to build and deploy a Shared Services Platform (SSP) on top of [Amazon EKS](https://aws.amazon.com/eks/).

## Installation

Using [npm](https://npmjs.org):

```bash
$ npm install @newrelic/newrelic-ssp-addon
```

## Usage

```
import { App } from '@aws-cdk/core';
import * as ssp from '@aws-quickstart/ssp-amazon-eks';
import { NewRelicAddOn } from '@newrelic/newrelic-ssp-addon';

const app = new App();

ssp.EksBlueprint.builder()
    .addOns(new ssp.MetricsServerAddOn)
    .addOns(new ssp.ClusterAutoScalerAddOn)
    .addOns(new ssp.addons.SSMAgentAddOn)
    .addOns(new NewRelicAddOn({
        nrLicenseKeySecretName: "nr-license-key", // stored in AWS Secrets Manager
        newRelicClusterName: "my-test-cluster",
        lowDataMode: true,
        installInfrastructure: true,
        installKSM: true,
        installPrometheus: false,
        installLogging: false
    }))
    .region(process.env.AWS_REGION)
    .account(process.env.AWS_ACCOUNT)
    .build(app, 'my-test-cluster');
```

## `NewRelicAddOn` Options (props)

#### `newRelicLicenseKey: string` (required)

New Relic License Key (plain text).  Use AWS Secrets Manager for added security.

#### `newRelicLicenseKeySecretName: string` (required)

Secret Name containing the New Relic License Key in AWS Secrets Manager.  Secret key should be `license_key`.

#### `newRelicClusterName: string` (required)

The name of the cluster to be displayed in the New Relic UI.

#### `namespace?: string` (optional)

The namespace where New Relic components will be installed. Defaults to `newrelic`.

#### `lowDataMode?: boolean` (optional)

Default `true`.  Set to `false` to disable `lowDataMode`.  For more details, visit https://docs.newrelic.com/docs/kubernetes-pixie/kubernetes-integration/installation/install-kubernetes-integration-using-helm/#reducedataingest

#### `installInfrastructure?: boolean` (optional)

Default `true`.  Set to `false` to disable installation of the New Relic Infrastructure Daemonset.

#### `installInfrastructurePrivileged?: boolean` (optional)

Default `true`.  Set to `false` to disable privileged install of the New Relic Infrastructure Daemonset.

#### `installKSM?: boolean` (optional)

Default `true`.  Set to `false` to disable installation of Kube State Metrics.  An instance of KSM is required in the cluster for the New Relic Infrastructure Daemonset to function properly.

#### `installPrometheus?: boolean` (optional)

Default `true`.  Set to `false` to disable installation of the Prometheus OpenMetrics Integration.

#### `installLogging?: boolean` (optional)

Default `true`.  Set to `false` to disable installation of the New Relic Logging (Fluent-Bit) Daemonset.

#### `version?: string` (optional)

Helm chart version.

#### `repository?: string`, `release?: string`, `chart?: string` (optional)

Additional options for customers who may need to supply their own private Helm repository.

####  `values?: { [key: string]: any }` (optional)

Custom values to pass to the chart. Config options: https://github.com/newrelic/helm-charts/tree/master/charts/nri-bundle#configuration

## Support

New Relic hosts and moderates an online forum where customers can interact with New Relic employees as well as other customers to get help and share best practices.

https://discuss.newrelic.com/

## Contributing
We encourage your contributions to improve newrelic-ssp-addon! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.
If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company,  please drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](../../security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

## License
newrelic-ssp-addon is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.
