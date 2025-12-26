import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LiveTVScreen from '../screens/tv/LiveTVScreen';
import TVPlayerScreen from '../screens/tv/TVPlayerScreen';
import DoodleTVSettingsScreen from '../screens/tv/DoodleTVSettingsScreen';
import { DoodleTVStackParamList } from '../App';

const Stack = createNativeStackNavigator<DoodleTVStackParamList>();

function DoodleTVStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                animation: 'fade',
                animationDuration: 200,
                freezeOnBlur: true,
                contentStyle: { backgroundColor: 'transparent' },
            }}>
            <Stack.Screen name="LiveTVScreen" component={LiveTVScreen} />
            <Stack.Screen name="TVPlayerScreen" component={TVPlayerScreen} />
            <Stack.Screen name="DoodleTVSettingsScreen" component={DoodleTVSettingsScreen} />
        </Stack.Navigator>
    );
}

export default DoodleTVStack;
