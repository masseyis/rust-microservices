import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Application as AppConfigApp, CfnEnvironment, CfnConfigurationProfile, CfnHostedConfigurationVersion, CfnDeployment } from 'aws-cdk-lib/aws-appconfig';

export class PlatformStack extends Stack {
  readonly bus: EventBus;
  readonly appConfigApp: AppConfigApp;
  readonly appConfigEnv: CfnEnvironment;
  readonly appConfigProfile: CfnConfigurationProfile;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.bus = new EventBus(this, 'Bus', { eventBusName: 'main-bus' });

    this.appConfigApp = new AppConfigApp(this, 'FlagsApp', { name: 'flags' });
    this.appConfigEnv = new CfnEnvironment(this, 'FlagsEnv', {
      applicationId: this.appConfigApp.applicationId,
      name: 'prod',
      description: 'Production flags',
    });
    this.appConfigProfile = new CfnConfigurationProfile(this, 'FlagsProfile', {
      applicationId: this.appConfigApp.applicationId,
      name: 'feature-flags',
      locationUri: 'hosted',
      type: 'AWS.AppConfig.FeatureFlags',
    });
    // Seed a default feature flag configuration and deploy it to 'prod'
    const hosted = new CfnHostedConfigurationVersion(this, 'FlagsHostedV1', {
      applicationId: this.appConfigApp.applicationId,
      configurationProfileId: this.appConfigProfile.ref,
      contentType: 'application/json',
      content: JSON.stringify({
        flags: {
          new_checkout: { state: 'disabled' },
          beta_banner: { state: 'disabled' }
        },
        values: {}
      })
    });

    new CfnDeployment(this, 'FlagsInitialDeployment', {
      applicationId: this.appConfigApp.applicationId,
      configurationProfileId: this.appConfigProfile.ref,
      configurationVersion: hosted.ref,
      environmentId: this.appConfigEnv.ref,
      deploymentStrategyId: 'AppConfig.AllAtOnce'
    });


    new CfnOutput(this, 'BusName', { value: this.bus.eventBusName });
  }
}
