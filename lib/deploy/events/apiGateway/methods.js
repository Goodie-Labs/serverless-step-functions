'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');

module.exports = {

  compileMethods() {
    this.apiGatewayMethodLogicalIds = [];
    this.pluginhttpValidated.events.forEach((event) => {
      const resourceId = this.getResourceId(event.http.path);
      const resourceName = this.getResourceName(event.http.path);
      const stateMachineObj = this.getStateMachine(event.stateMachineName);

      const template = {
        Type: 'AWS::ApiGateway::Method',
        Properties: {
          HttpMethod: event.http.method.toUpperCase(),
          RequestParameters: {},
          AuthorizationType: 'NONE',
          ResourceId: resourceId,
          RestApiId: { Ref: this.apiGatewayRestApiLogicalId },
        },
      };

      _.merge(template,
        this.getMethodIntegration(event.stateMachineName, stateMachineObj.name, event.http),
        this.getMethodResponses(event.http)
      );

      const methodLogicalId = this.provider.naming
        .getMethodLogicalId(resourceName, event.http.method);

      this.apiGatewayMethodLogicalIds.push(methodLogicalId);

      _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, {
        [methodLogicalId]: template,
      });
    });

    return BbPromise.resolve();
  },

  getMethodIntegration(stateMachineName, customName, http) {
    const stateMachineLogicalId = this.getStateMachineLogicalId(stateMachineName, customName);
    const apiToStepFunctionsIamRoleLogicalId = this.getApiToStepFunctionsIamRoleLogicalId();
    const integration = {
      IntegrationHttpMethod: 'POST',
      Type: 'AWS',
      Credentials: {
        'Fn::GetAtt': [
          `${apiToStepFunctionsIamRoleLogicalId}`,
          'Arn',
        ],
      },
      Uri: {
        'Fn::Join': [
          '',
          [
            'arn:aws:apigateway:',
            {
              Ref: 'AWS::Region',
            },
            ':states:action/StartExecution',
          ],
        ],
      },
      PassthroughBehavior: 'NEVER',
      RequestTemplates: {
        'application/json': {
          'Fn::Join': [
            '', [
              "#set( $body = $util.escapeJavaScript($input.json('$')) ) \n\n",
              '{"input": \"{\\"body\\": $body, \\"headers\\": {\\"X-Hub-Signature\\": \\"$input.params(\'X-Hub-Signature\')\\", \\"X-GitHub-Event\\":\\"$input.params(\'X-GitHub-Event\')\\", \\"X-GitHub-Delivery\\":\\"$input.params(\'X-GitHub-Delivery\')\\"}}\","name": "$context.requestId","stateMachineArn":"',
              {
                Ref: `${stateMachineLogicalId}`,
              },
              '"}',
            ],
          ],
        },
        'application/x-www-form-urlencoded': {
          'Fn::Join': [
            '', [
              "#set( $body = $util.escapeJavaScript($input.json('$')) ) \n\n",
              '{"input": \"{\\"body\\": $body, \\"headers\\": {\\"X-Hub-Signature\\": \\"$input.params(\'X-Hub-Signature\')\\", \\"X-GitHub-Event\\":\\"$input.params(\'X-GitHub-Event\')\\", \\"X-GitHub-Delivery\\":\\"$input.params(\'X-GitHub-Delivery\')\\"}}\","name": "$context.requestId","stateMachineArn":"',
              {
                Ref: `${stateMachineLogicalId}`,
              },
              '"}',
            ],
          ],
        },
      },
    };

    const integrationResponse = {
      IntegrationResponses: [
        {
          StatusCode: 200,
          SelectionPattern: 200,
          ResponseParameters: {},
          ResponseTemplates: {},
        },
        {
          StatusCode: 400,
          SelectionPattern: 400,
          ResponseParameters: {},
          ResponseTemplates: {},
        },
      ],
    };

    if (http && http.cors) {
      let origin = http.cors.origin;
      if (http.cors.origins && http.cors.origins.length) {
        origin = http.cors.origins.join(',');
      }

      integrationResponse.IntegrationResponses.forEach((val, i) => {
        integrationResponse.IntegrationResponses[i].ResponseParameters = {
          'method.response.header.Access-Control-Allow-Origin': `'${origin}'`,
        };
      });
    }

    _.merge(integration, integrationResponse);

    return {
      Properties: {
        Integration: integration,
      },
    };
  },

  getMethodResponses(http) {
    const methodResponse = {
      Properties: {
        MethodResponses: [
          {
            ResponseParameters: {},
            ResponseModels: {},
            StatusCode: 200,
          },
          {
            ResponseParameters: {},
            ResponseModels: {},
            StatusCode: 400,
          },
        ],
      },
    };

    if (http && http.cors) {
      let origin = http.cors.origin;
      if (http.cors.origins && http.cors.origins.length) {
        origin = http.cors.origins.join(',');
      }

      methodResponse.Properties.MethodResponses.forEach((val, i) => {
        methodResponse.Properties.MethodResponses[i].ResponseParameters = {
          'method.response.header.Access-Control-Allow-Origin': `'${origin}'`,
        };
      });
    }

    return methodResponse;
  },
};
