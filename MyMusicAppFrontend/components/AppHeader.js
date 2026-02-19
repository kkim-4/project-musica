import React from 'react';
import { View, Text, StyleSheet, Image, SafeAreaView, Platform } from 'react-native';
import { COLORS } from '../constants/theme';

const AppHeader = () => {
  return (
    // SafeAreaView ensures content isn't hidden by notches on mobile
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Image
          source={require('../assets/logo.png')} // Make sure you have a logo image here
          style={styles.logo}
        />
        <Text style={styles.headerTitle}>Replay'd</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.primary, // Navy
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Platform.OS === 'android' ? 60 : 50, // Adjust height for different platforms
    paddingHorizontal: 15,
    backgroundColor: COLORS.primary, // Navy
  },
  logo: {
    width: 35,
    height: 35,
    marginRight: 10,
    resizeMode: 'contain',
  },
  headerTitle: {
    color: COLORS.textPrimary, // White
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default AppHeader;