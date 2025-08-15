import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Runtime, Code, Function, Architecture, Alias } from 'aws-cdk-lib/aws-lambda';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { LambdaProxyIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Table, BillingMode, AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { addCanary } from './canary';
import { PlatformStack } from './platform-stack';

interface Props extends StackProps { platform: PlatformStack }

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, { platform, ...props }: Props) {
    super(scope, id, props);

    const orders = new Table(this, 'Orders', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const fn = new Function(this, 'ApiFn', {
      runtime: Runtime.PROVIDED_AL2023,
      architecture: Architecture.X86_64,
      handler: 'bootstrap',
      code: Code.fromAsset('../target/lambda/api'),
      environment: {
        EVENT_BUS: platform.bus.eventBusName,
        APPCONFIG_APP: platform.appConfigApp.applicationId,
        APPCONFIG_ENV: platform.appConfigEnv.ref,
        APPCONFIG_PROFILE: platform.appConfigProfile.ref,
        ORDERS_TABLE: orders.tableName,
      },
    });
    orders.grantReadWriteData(fn);
    platform.bus.grantPutEventsTo(fn);

    const alias = new Alias(this, 'ApiLive', { aliasName: 'live', version: fn.currentVersion });
    addCanary(fn, alias, 'Api');

    const api = new HttpApi(this, 'HttpApi', { });
    api.addRoutes({ path: '/{proxy+}', integration: new LambdaProxyIntegration({ handler: alias }) });

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint! });
  }
}
