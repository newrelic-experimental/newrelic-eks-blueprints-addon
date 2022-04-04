import * as cdk from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { InstanceType } from 'aws-cdk-lib/aws-ec2';
import { NewRelicAddOn } from '@newrelic/newrelic-eks-blueprints-addon';
import { CapacityType, KubernetesVersion, NodegroupAmiType } from 'aws-cdk-lib/aws-eks';
import { Construct } from "constructs";

import * as team from '../../teams';

const teamPlatformManifests = './examples/teams/team-platform/';
const teamApplicationManifests = './examples/teams/team-application/';

const app = new cdk.App();

export interface BlueprintConstructProps {
   /**
    * Id
    */
   id: string
}

export default class BlueprintConstruct extends Construct {
   constructor(scope: Construct, blueprintProps: BlueprintConstructProps, props: cdk.StackProps) {
       super(scope, blueprintProps.id);

       const teams: Array<blueprints.Team> = [
         new team.TeamApplication(scope, process.env.CDK_DEFAULT_ACCOUNT!),
         new team.TeamPlatform(process.env.CDK_DEFAULT_ACCOUNT!)
     ];

     const addOns: Array<blueprints.ClusterAddOn> = [
      new blueprints.addons.AwsLoadBalancerControllerAddOn(),
      new blueprints.addons.SecretsStoreAddOn(),
      // new blueprints.addons.NginxAddOn({
      //     values: {
      //         controller: { service: { create: false } }
      //     }
      // }),
      // new blueprints.addons.VeleroAddOn(),
      new blueprints.addons.VpcCniAddOn(),
      new blueprints.addons.CoreDnsAddOn(),
      new blueprints.addons.KubeProxyAddOn(),
      new NewRelicAddOn({
         version: "4.2.0-beta",
         newRelicClusterName: `${blueprintProps.id}-test`,
         awsSecretName: "newrelic-pixie-combined", // Secret Name in AWS Secrets Manager
         installPixie: true,
         installPixieIntegration: true,
     })
      // ssp.addons.OpaGatekeeperAddOn(),
      // new blueprints.addons.KarpenterAddOn(),
      // new blueprints.addons.KubeviousAddOn(),
      // new blueprints.addons.EbsCsiDriverAddOn(),
      // new blueprints.addons.EfsCsiDriverAddOn({replicaCount: 1}),
   ];

      const blueprintID = `${blueprintProps.id}-test`;

      const clusterProvider = new blueprints.GenericClusterProvider({
         version: KubernetesVersion.V1_21,
         managedNodeGroups: [
             {
                 id: "mng1",
                 amiType: NodegroupAmiType.AL2_X86_64,
                 instanceTypes: [new InstanceType('m5.large')]
             },
             {
                 id: "mng2-custom",
                 instanceTypes: [new InstanceType('m5.large')],
                 nodeGroupCapacityType: CapacityType.SPOT,
                //  customAmi: {
                //      machineImage: ec2.MachineImage.genericLinux({
                //          'us-east-1': 'ami-0b297a512e2852b89',
                //          'us-west-2': 'ami-06a8c459c01f55c7b',
                //          'us-east-2': 'ami-093d9796e55a5b860',
                //      }),
                //      //userData: userData,
                //  }
             }
         ]
     });

     blueprints.EksBlueprint.builder()
            .addOns(...addOns)
            .clusterProvider(clusterProvider)
            .teams(...teams)
            .enableControlPlaneLogTypes('api')
            .build(scope, blueprintID, props);
    }

}