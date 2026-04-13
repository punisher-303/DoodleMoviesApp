module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        { unstable_transformImportMeta: true }
      ]
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            'moti/skeleton': 'moti/skeleton/react-native-linear-gradient',
          },
        },
      ],
      '@babel/plugin-transform-export-namespace-from',
      'nativewind/babel',
      'react-native-reanimated/plugin',
    ],
  };
};
