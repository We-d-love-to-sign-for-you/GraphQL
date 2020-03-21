import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import Appsync = require('../lib/appsync-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Appsync.AppsyncStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
