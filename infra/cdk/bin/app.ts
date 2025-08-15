import { App } from 'aws-cdk-lib';
import { PlatformStack } from '../lib/platform-stack';
import { ApiStack } from '../lib/api-stack';
import { ProjectorOrdersStack } from '../lib/projector-orders-stack';
import { ProjectorUsersStack } from '../lib/projector-users-stack';

const app = new App();
const platform = new PlatformStack(app, 'PlatformStack');

new ApiStack(app, 'ApiStack', { platform });
new ProjectorOrdersStack(app, 'ProjectorOrdersStack', { platform });
new ProjectorUsersStack(app, 'ProjectorUsersStack', { platform });
