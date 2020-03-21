#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AppSyncStack } from '../lib/appsync-stack';

const app = new cdk.App();
new AppSyncStack(app, 'AppSyncStack');
