module.exports = {
  presets: ['module:@react-native/babel-preset'],
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
