import { registerRootComponent } from 'expo';

import App from './src/App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in the Expo client or build it into an APK/IPA,
// the environment is set up appropriately
registerRootComponent(App);
