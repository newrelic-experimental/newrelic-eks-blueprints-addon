import { PlatformTeam } from '@aws-quickstart/eks-blueprints';
import { ArnPrincipal } from 'aws-cdk-lib/aws-iam';


export class TeamPlatform extends PlatformTeam {
    constructor(accountID: string) {
        super({
            name: "platform",
            userRoleArn: `arn:aws:iam::${accountID}:role/Admin`,
            users: [new ArnPrincipal(`arn:aws:iam::${accountID}:user/bschmitt`)]
        });
    }
}