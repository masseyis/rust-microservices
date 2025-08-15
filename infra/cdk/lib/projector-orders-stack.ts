import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Runtime, Code, Function, Architecture, Alias } from 'aws-cdk-lib/aws-lambda';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Table, BillingMode, AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { addCanary } from './canary';
import { PlatformStack } from './platform-stack';

interface Props extends StackProps { platform: PlatformStack }

export class ProjectorOrdersStack extends Stack {
  constructor(scope: Construct, id: string, { platform, ...props }: Props) {
    super(scope, id, props);

    const table = new Table(this, 'OrdersView', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const fn = new Function(this, 'ProjectorOrdersFn', {
      runtime: Runtime.PROVIDED_AL2023,
      architecture: Architecture.X86_64,
      handler: 'bootstrap',
      code: Code.fromAsset('../target/lambda/projector_orders'),
      environment: { ORDERS_TABLE: table.tableName },
    });

    table.grantReadWriteData(fn);

    const alias = new Alias(this, 'ProjectorOrdersLive', { aliasName: 'live', version: fn.currentVersion });
    addCanary(fn, alias, 'ProjectorOrders');

    const rule = new Rule(this, 'OrderPlacedRule', {
      eventBus: platform.bus,
      eventPattern: { source: [ 'api' ], detailType: [ 'Event' ] }
    });
    rule.addTarget(new LambdaFunction(alias));
  }
}
