import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'; // ✅ Bottom tab navigator
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from './screens/HomeScreen';
import ChartsScreen from './screens/ChartsScreen';
import SearchScreen from './screens/SearchScreen';
import MyLibraryScreen from './screens/MyLibraryScreen';
import ProfileScreen from './screens/ProfileScreen';
import AddToPlaylistScreen from './screens/AddToPlaylistScreen';
import PlaylistDetailScreen from './screens/PlaylistDetailScreen';
import ArtistDetailScreen from './screens/ArtistDetailScreen';

import { COLORS } from './constants/theme';

const Tab = createBottomTabNavigator(); // ✅ Changed
const LibraryStack = createStackNavigator();
const RootStack = createStackNavigator();

function LibraryStackScreen() {
  return (
    <LibraryStack.Navigator screenOptions={{ headerShown: false }}>
      <LibraryStack.Screen name="MyLibraryMain" component={MyLibraryScreen} />
      <LibraryStack.Screen name="AddToPlaylist" component={AddToPlaylistScreen} />
      <LibraryStack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
    </LibraryStack.Navigator>
  );
}

function MainAppBottomTabs() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    console.log('MainAppBottomTabs mounted');
  }, []);

  return (
    <Tab.Navigator
      initialRouteName="Profile"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Search') iconName = focused ? 'search' : 'search-outline';
          else if (route.name === 'My Library') iconName = focused ? 'library' : 'library-outline';
          else if (route.name === 'Charts') iconName = focused ? 'podium' : 'podium-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.textPrimary,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          backgroundColor: COLORS.primary,
          height: Platform.OS === 'ios' ? 60 + insets.bottom : 60,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 10,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="My Library" component={LibraryStackScreen} />
      <Tab.Screen name="Charts" component={ChartsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    console.log('App mounted');
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="MainApp" component={MainAppBottomTabs} />
          <RootStack.Screen name="ArtistDetail" component={ArtistDetailScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
