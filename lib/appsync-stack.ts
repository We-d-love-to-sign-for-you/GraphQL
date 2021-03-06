import * as cdk from '@aws-cdk/core';
import * as path from 'path';
import {
    GraphQLApi,
    MappingTemplate,
    PrimaryKey,
    Values,
    AuthorizationConfig,
} from '@aws-cdk/aws-appsync';
import { Table, BillingMode, AttributeType } from '@aws-cdk/aws-dynamodb';
import { Function } from '@aws-cdk/aws-lambda';
import { RemovalPolicy } from '@aws-cdk/core';
import { Group, Policy } from '@aws-cdk/aws-iam';
import { Bucket, BucketAccessControl } from '@aws-cdk/aws-s3';

export class AppSyncStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const deployGroup = new Group(this, `${id}-deploy-group`, {
            groupName: `${id}-deploy-group`,
        });

        const appSync = new GraphQLApi(this, `${id}-api`, {
            name: 'love2sign4you',
            schemaDefinitionFile: path.join(__dirname, 'schema.graphql'),
            authorizationConfig: {
                defaultAuthorization: {
                    apiKeyDesc: 'ChatBot',
                    expires: '2020-06-01T12:00:00+00:00',
                },
            },
        });

        const interpreterTable = new Table(this, `InterpreterTableCDK`, {
            tableName: `${id}-interpreter`,
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY,
            partitionKey: {
                name: 'id',
                type: AttributeType.STRING,
            },
        });

        const bucket = new Bucket(this, `${id}-bucket`, {
            bucketName: id,
            removalPolicy: RemovalPolicy.DESTROY,
        });
        bucket.grantPublicAccess('public/*');

        bucket.grantReadWrite(deployGroup, 'public/*');

        const schedulerLambda = Function.fromFunctionArn(
            this,
            'schedulerLambda',
            'arn:aws:lambda:eu-west-1:658983008883:function:schedulerTest'
        );

        const interpreterDataSource = appSync.addDynamoDbDataSource(
            'Interpreter',
            'The interpreters data source',
            interpreterTable
        );
        const schedulerDataSource = appSync.addLambdaDataSource(
            'Scheduler',
            'The scheduler data source',
            schedulerLambda
        );

        interpreterDataSource.createResolver({
            typeName: 'Query',
            fieldName: 'getInterpreter',
            requestMappingTemplate: MappingTemplate.dynamoDbGetItem('id', 'id'),
            responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
        });

        interpreterDataSource.createResolver({
            typeName: 'Query',
            fieldName: 'listInterpreters',
            requestMappingTemplate: MappingTemplate.fromString(`{
                "version": "2017-02-28",
                "operation": "Scan",
                "filter": #if($context.args.filter) $util.transform.toDynamoDBFilterExpression($ctx.args.filter) #else null #end,
                "limit": $util.defaultIfNull($ctx.args.limit, 20),
                "nextToken": $util.toJson($util.defaultIfNullOrEmpty($ctx.args.nextToken, null)),
            }`),
            responseMappingTemplate: MappingTemplate.fromString(
                `$util.toJson($context.result)`
            ),
        });

        schedulerDataSource.createResolver({
            fieldName: 'getHelp',
            typeName: 'Query',
            requestMappingTemplate: MappingTemplate.fromString(`{
                "version" : "2017-02-28",
                "operation": "Invoke",
                "payload": $util.toJson($context.args)
            }`),
            responseMappingTemplate: MappingTemplate.fromString(
                `$util.toJson($context.result)`
            ),
        });

        interpreterDataSource.createResolver({
            typeName: 'Mutation',
            fieldName: 'createInterpreter',
            requestMappingTemplate: MappingTemplate.dynamoDbPutItem(
                PrimaryKey.partition('id').auto(),
                Values.projecting('input')
            ),
            responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
        });

        interpreterDataSource.createResolver({
            typeName: 'Mutation',
            fieldName: 'updateInterpreter',
            requestMappingTemplate: MappingTemplate.fromFile(
                path.join(__dirname, 'update-resolver.json')
            ),
            responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
        });

        interpreterDataSource.createResolver({
            typeName: 'Mutation',
            fieldName: 'deleteInterpreter',
            requestMappingTemplate: MappingTemplate.dynamoDbDeleteItem(
                'input.id',
                'id'
            ),
            responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
        });
    }
}
