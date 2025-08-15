# Rust AWS Microservices Seed

Event-driven microservices in Rust on AWS with Lambda + API Gateway + EventBridge + DynamoDB, feature flags (AppConfig), and canary deploys (CodeDeploy).

## Quick start
1. **Bootstrap CDK**
   ```bash
   npm -g i aws-cdk
   npx cdk bootstrap aws://420053132780/eu-west-2
   ```
2. **Create a GitHub OIDC role** in AWS IAM named `<GITHUB_OIDC_ROLE>` that your repo can assume. Grant minimum permissions for: CloudFormation/CDK, Lambda, CodeDeploy, DynamoDB, EventBridge, AppConfig, CloudWatch.
3. **Push to `main`** — the GitHub Actions build the Lambda zips and `cdk deploy` the stacks.
4. **Create a FeatureFlags config** in AppConfig with YAML:
   ```yaml
   default:
     new_checkout: false
     beta_banner: false
   ```

## Services
- `services/api`: HTTP API → emits domain events to EventBridge.
- `services/projector_orders`: listens to events → writes Orders view in DynamoDB.
- `services/projector_users`: listens to events → writes Users view.

## Canary
Each Lambda has alias `live` with CodeDeploy `CANARY_10PERCENT_5MINUTES` and a CloudWatch error alarm for auto-rollback.
