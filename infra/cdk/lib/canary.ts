import { Duration } from 'aws-cdk-lib';
import { Alias, IFunction } from 'aws-cdk-lib/aws-lambda';
import { Alarm, ComparisonOperator, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { LambdaDeploymentGroup, LambdaDeploymentConfig } from 'aws-cdk-lib/aws-codedeploy';

export function addCanary(fn: IFunction, alias: Alias, id: string) {
  const alarm = new Alarm(alias, `${id}ErrorAlarm`, {
    metric: new Metric({
      namespace: 'AWS/Lambda',
      metricName: 'Errors',
      statistic: 'sum',
      period: Duration.minutes(1),
      dimensionsMap: { FunctionName: fn.functionName },
    }),
    threshold: 1,
    evaluationPeriods: 1,
    comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  });

  new LambdaDeploymentGroup(alias, `${id}DG`, {
    alias,
    deploymentConfig: LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES,
    alarms: [alarm],
  });
}
