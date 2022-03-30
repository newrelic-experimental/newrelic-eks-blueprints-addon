import { ArnPrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from "constructs";
import { ApplicationTeam, GenerateSecretManagerProvider } from '@aws-quickstart/eks-blueprints';

// function getUserArns(scope: Construct, key: string): ArnPrincipal[] {
//     const context: string = scope.node.tryGetContext(key);
//     if (context) {
//         return context.split(",").map(e => new ArnPrincipal(e));
//     }
//     return [];
// }

export class TeamApplication extends ApplicationTeam {
    constructor(scope: Construct, accountID: string) {
        super({
            name: "team-application",
            users: [
                new ArnPrincipal(`arn:aws:iam::${accountID}:user/bschmitt-test1`),
                new ArnPrincipal(`arn:aws:iam::${accountID}:user/bschmitt-test2`)
            ]
        //teamManifestDir: './examples/teams/team-awesome/'
        });
    }
}