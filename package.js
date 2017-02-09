// @flow
Package.describe({
  documentation: 'README.md',
  git: 'git+https://github.com/meteor-collectionbehaviours/softremove',
  name: 'collectionbehaviours:softremove',
  summary: 'Soft remove documents in your collections',
  version: '1.0.0-alpha.1',
});

Package.onUse(function onUse(api) {
  api.versionsFrom('1.4.2.2');

  api.use([
    'check',
    'ecmascript',
    'matb33:collection-hooks@0.8.4',
    'mongo',
  ]);

  api.mainModule('behaviour.js', ['client', 'server'], { lazy: true });
});
