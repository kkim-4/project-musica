/*import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Alert, ActivityIndicator, Image,
  TouchableOpacity, Platform, ScrollView, KeyboardAvoidingView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, getAuthToken, setAuthToken } from '../utils/api';
import * as jwtDecodeLibrary from 'jwt-decode';
import * as ImagePicker from 'expo-image-picker'; 
import { COLORS } from '../constants/theme';
import { Formik } from 'formik';
import * as yup from 'yup';

// --- Validation Schemas for Formik ---
const loginValidationSchema = yup.object().shape({
  email: yup.string().email("Please enter a valid email").required('Email is required'),
  password: yup.string().required('Password is required'),
});

const signupValidationSchema = yup.object().shape({
  username: yup.string().min(3, 'Username must be at least 3 characters').required('Username is required'),
  email: yup.string().email("Please enter a valid email").required('Email is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

// --- Reusable Form Components ---
const AuthForm = ({ isLoginView, isSubmitting, handleSubmit }) => (
  <Formik
    validationSchema={isLoginView ? loginValidationSchema : signupValidationSchema}
    initialValues={{ email: '', password: '', username: '' }}
    onSubmit={handleSubmit}
  >
    {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isValid }) => (
      <>
        <View style={{ backgroundColor: 'orange', width: '90%', padding: 15, marginVertical: 10, borderRadius: 8, zIndex: 9999 }}>
          <Text style={{ color: 'black', fontSize: 22, fontWeight: 'bold', textAlign: 'center' }}>AUTH FORM TEST!</Text>
          <Text style={{ color: 'black', fontSize: 14, textAlign: 'center', marginTop: 5 }}>
            {isLoginView ? 'Login fields should be below.' : 'Signup fields should be below.'}
          </Text>
        </View>

        {!isLoginView && (
          <>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={22} color={COLORS.inactive} style={styles.icon} />
              <TextInput
                style={styles.input} placeholder="Username" value={values.username}
                onChangeText={handleChange('username')} onBlur={handleBlur('username')}
                placeholderTextColor={COLORS.inactive} autoCapitalize="none"
              />
            </View>
            {errors.username && touched.username && <Text style={styles.errorText}>{errors.username}</Text>}
          </>
        )}

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={22} color={COLORS.inactive} style={styles.icon} />
          <TextInput
            style={styles.input} placeholder="Email" value={values.email}
            onChangeText={handleChange('email')} onBlur={handleBlur('email')}
            keyboardType="email-address" autoCapitalize="none" placeholderTextColor={COLORS.inactive}
          />
        </View>
        {errors.email && touched.email && <Text style={styles.errorText}>{errors.email}</Text>}

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={22} color={COLORS.inactive} style={styles.icon} />
          <TextInput
            style={styles.input} placeholder="Password" value={values.password}
            onChangeText={handleChange('password')} onBlur={handleBlur('password')}
            secureTextEntry placeholderTextColor={COLORS.inactive}
          />
        </View>
        {errors.password && touched.password && <Text style={styles.errorText}>{errors.password}</Text>}
        
        <TouchableOpacity style={[styles.button, (!isValid || isSubmitting) && styles.disabledButton]} onPress={handleSubmit} disabled={!isValid || isSubmitting}>
          <Text style={styles.buttonText}>{isLoginView ? "Sign In" : "Sign Up"}</Text>
        </TouchableOpacity>
      </>
    )}
  </Formik>
);


const ProfileScreen = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoginView, setIsLoginView] = useState(true); 
  
  const [editableUsername, setEditableUsername] = useState('');
  const [editableAvatarUrl, setEditableAvatarUrl] = '';

  useFocusEffect(
    useCallback(() => {
      const checkAuthStatus = async () => {
        setIsLoading(true); 
        console.log("ProfileScreen: checkAuthStatus initiated.");
        try {
          const token = await getAuthToken();
          console.log("ProfileScreen: Got token:", token ? "present" : "absent");

          if (token) {
            let decodeFunction;
            if (typeof jwtDecodeLibrary.jwtDecode === 'function') {
              decodeFunction = jwtDecodeLibrary.jwtDecode;
            } else if (typeof jwtDecodeLibrary.default === 'function') {
              decodeFunction = jwtDecodeLibrary.default;
            } else if (typeof jwtDecodeLibrary === 'function') {
              decodeFunction = jwtDecodeLibrary;
            } else {
              console.error("ProfileScreen: Critical Error: jwt-decode function not found.");
              throw new Error("Failed to initialize JWT decoder.");
            }
            
            const decoded = decodeFunction(token);
            console.log("ProfileScreen: Token decoded. Expiry:", new Date(decoded.exp * 1000).toLocaleString());

            if (decoded.exp * 1000 > Date.now()) {
              console.log("ProfileScreen: Token is valid. Fetching user profile.");
              const profile = await api.getUserProfile();
              console.log("ProfileScreen: User profile fetched. Data:", profile);
              
              if (profile && profile.username) {
                  setUser(profile);
                  setEditableUsername(profile.username);
                  setEditableAvatarUrl(profile.avatar_url || '');
                  setIsLoginView(false); 
                  console.log("ProfileScreen: User data set, rendering profile view.");
              } else {
                  console.log("ProfileScreen: User profile fetched but data is incomplete or empty. Setting to login view.");
                  await setAuthToken(null); 
                  setUser(null);
                  setIsLoginView(true); 
              }
            } else {
              console.log("ProfileScreen: Token expired. Clearing token.");
              await setAuthToken(null);
              setUser(null);
              setIsLoginView(true); 
            }
          } else { // No token
            console.log("ProfileScreen: No token found. Setting to login view.");
            setUser(null);
            setIsLoginView(true); 
          }
        } catch (error) {
          console.error('ProfileScreen: Auth check failed:', error.message, error);
          Alert.alert("Authentication Failed", error.message);
          await setAuthToken(null);
          setUser(null);
          setIsLoginView(true); 
        } finally {
          setIsLoading(false); 
          console.log("ProfileScreen: checkAuthStatus finished. isLoading set to false.");
        }
      };
      checkAuthStatus();
    }, [])
  );

  const handleAuth = async (values) => {
    setIsLoading(true); 
    try {
      const authFunction = isLoginView ? api.login : api.register;
      const response = await authFunction(values.email, values.password, values.username);
      if (response.token) {
        await setAuthToken(response.token);
        setUser(response.user);
        setEditableUsername(response.user.username || '');
        setEditableAvatarUrl(response.user.avatar_url || '');
        setIsLoginView(false); 
        console.log("ProfileScreen: Auth successful, rendering profile view.");
      }
    } catch (error) {
      console.error('ProfileScreen: Auth attempt failed:', error.message, error);
      Alert.alert(isLoginView ? 'Sign In Failed' : 'Sign Up Failed', error.message);
    } finally {
      setIsLoading(false); 
    }
  };

  const handleSignOut = async () => {
    console.log("ProfileScreen: Signing out.");
    await api.logout();
    setUser(null);
    setIsLoginView(true); 
  };
  
  const handleUpdateProfile = async () => {
    if (user && editableUsername === user.username && editableAvatarUrl === user.avatar_url) {
      Alert.alert("No Changes", "No changes were made to update.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.updateUserProfile({ username: editableUsername, avatar_url: editableAvatarUrl });
      setUser(response.user);
      Alert.alert("Success", "Profile updated!");
    } catch (error) {
      Alert.alert("Update Failed", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync(); 
    if (status !== 'granted') return Alert.alert('Permission Denied', 'Camera roll access is required.');
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5,
    });
    if (result.assets && result.assets.length > 0) {
      setEditableAvatarUrl(result.assets[0].uri);
    }
  };

  if (isLoading) {
    return <View style={styles.loaderContainer}><ActivityIndicator size="large" color={COLORS.textPrimary} /></View>;
  }

  return (
    // This is the absolute outermost container for ProfileScreen content
    <View style={styles.outermostContainer}> 
        {user ? (
            // --- ULTIMATE TEST RENDER: LOGGED-IN VIEW ---
            <View style={{ 
                backgroundColor: 'yellow', 
                width: '90%',           // Make it wider
                height: 350,            // Make it taller
                position: 'absolute',   // Force it to absolute position (might help with layering)
                top: '10%',             // Position it from the top
                left: '5%',             // Position it from the left
                justifyContent: 'center', 
                alignItems: 'center', 
                padding: 20, 
                borderRadius: 15,
                borderWidth: 5, 
                borderColor: 'lime', 
                zIndex: 9999,           // Ensure it's on top of everything
            }}> 
                <Text style={{ color: 'black', fontSize: 30, fontWeight: 'bold', marginBottom: 20 }}>TEST RENDER!</Text>
                <Text style={{ color: 'black', fontSize: 22, textAlign: 'center' }}>Welcome, {user.username}!</Text>
                <Text style={{ color: 'black', fontSize: 18, marginTop: 10 }}>If you see this, rendering is working!</Text>
                <TouchableOpacity style={{ backgroundColor: 'blue', padding: 10, borderRadius: 5, marginTop: 20 }} onPress={handleSignOut}>
                    <Text style={{ color: 'white' }}>Sign Out Test</Text>
                </TouchableOpacity>
            </View>
            // --- END ULTIMATE TEST RENDER ---
        ) : (
            // Login/Signup form content (also make explicitly visible for test if not already)
            <View style={{ 
                backgroundColor: 'orange', 
                width: '90%', 
                height: 450, 
                position: 'absolute',   // Absolute position
                top: '5%',              // Position from top
                left: '5%',             // Position from left
                justifyContent: 'center', 
                alignItems: 'center', 
                padding: 20, 
                borderRadius: 15,
                borderWidth: 5,
                borderColor: 'purple',
                zIndex: 9999,           // Ensure it's on top
            }} accessibilityRole="form">
                <Text style={styles.title}>{isLoginView ? 'Login' : 'Create Account'}</Text>
                <AuthForm key={isLoginView ? "loginForm" : "signupForm"} isLoginView={isLoginView} handleSubmit={handleAuth} isSubmitting={isLoading} /> 
                <TouchableOpacity onPress={() => setIsLoginView(!isLoginView)} style={styles.toggleAuth}>
                    <Text style={styles.toggleAuthText}>
                        {isLoginView ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </Text>
                </TouchableOpacity>
            </View>
        )}
    </View>
  );
};

const styles = StyleSheet.create({
    outermostContainer: { // New style for the very top-level View in ProfileScreen
      flex: 1, // Make it take full height
      backgroundColor: COLORS.primary, // Navy background
      justifyContent: 'center', // Center content vertically
      alignItems: 'center',     // Center content horizontally
    },
    keyboardAvoidingView: { flex: 1, backgroundColor: COLORS.primary }, // Not used in current render path
    container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: COLORS.primary }, // Not used in current render path
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary },
    contentContainer: { // Default contentContainer styles (overridden by inline for test)
      width: '100%', 
      alignItems: 'center', 
      padding: 20, 
      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
      borderRadius: 15 
    },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: COLORS.textPrimary },
    inputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', height: 50, backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: 8, paddingHorizontal: 10, marginBottom: 5 },
    icon: { marginRight: 10 },
    input: { flex: 1, height: '100%', color: COLORS.textPrimary, fontSize: 16 },
    button: { width: '100%', height: 50, backgroundColor: COLORS.accent, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    disabledButton: { opacity: 0.5 },
    buttonText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
    toggleAuth: { marginTop: 25, padding: 10 },
    toggleAuthText: { color: COLORS.accent, fontSize: 16 },
    errorText: { color: '#ff7675', width: '100%', marginLeft: 10, marginTop: -2, marginBottom: 10 },
    welcomeText: { fontSize: 22, marginBottom: 20, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },
    buttonSpacing: { height: 20 },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 10, borderWidth: 1, borderColor: COLORS.inactive },
    signOutButton: { backgroundColor: '#c0392b' },
    subtitle: { fontSize: 18, marginBottom: 10, color: COLORS.textPrimary },
});

export default ProfileScreen; */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, ActivityIndicator,
  TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Formik } from 'formik';
import * as yup from 'yup';
import * as jwtDecodeLibrary from 'jwt-decode';
import * as ImagePicker from 'expo-image-picker';

import { api, getAuthToken, setAuthToken } from '../utils/api';
import { COLORS } from '../constants/theme';

const loginValidationSchema = yup.object().shape({
  email: yup.string().email("Enter a valid email").required("Email required"),
  password: yup.string().required("Password required"),
});

const signupValidationSchema = yup.object().shape({
  username: yup.string().min(3).required("Username required"),
  email: yup.string().email("Enter a valid email").required("Email required"),
  password: yup.string().min(6).required("Password required"),
});

const AuthForm = ({ isLoginView, isSubmitting, handleSubmit }) => (
  <Formik
    validationSchema={isLoginView ? loginValidationSchema : signupValidationSchema}
    initialValues={{ email: '', password: '', username: '' }}
    onSubmit={handleSubmit}
  >
    {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isValid }) => (
      <>
        {!isLoginView && (
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={22} color={COLORS.textPrimary} style={styles.icon} />
            <TextInput
              placeholder="Username"
              placeholderTextColor={COLORS.inactive}
              style={styles.input}
              value={values.username}
              onChangeText={handleChange('username')}
              onBlur={handleBlur('username')}
              autoCapitalize="none"
            />
          </View>
        )}
        {errors.username && touched.username && <Text style={styles.errorText}>{errors.username}</Text>}

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={22} color={COLORS.textPrimary} style={styles.icon} />
          <TextInput
            placeholder="Email"
            placeholderTextColor={COLORS.inactive}
            style={styles.input}
            value={values.email}
            onChangeText={handleChange('email')}
            onBlur={handleBlur('email')}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        {errors.email && touched.email && <Text style={styles.errorText}>{errors.email}</Text>}

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={22} color={COLORS.textPrimary} style={styles.icon} />
          <TextInput
            placeholder="Password"
            placeholderTextColor={COLORS.inactive}
            style={styles.input}
            value={values.password}
            onChangeText={handleChange('password')}
            onBlur={handleBlur('password')}
            secureTextEntry
          />
        </View>
        {errors.password && touched.password && <Text style={styles.errorText}>{errors.password}</Text>}

        <TouchableOpacity
          style={[styles.button, (!isValid || isSubmitting) && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          <Text style={styles.buttonText}>{isLoginView ? 'Sign In' : 'Sign Up'}</Text>
        </TouchableOpacity>
      </>
    )}
  </Formik>
);

const ProfileScreen = () => {
  const [user, setUser] = useState(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const checkAuth = async () => {
      try {
        const token = await getAuthToken();
        if (token) {
          const decode = jwtDecodeLibrary.jwtDecode || jwtDecodeLibrary.default || jwtDecodeLibrary;
          const decoded = decode(token);
          if (decoded.exp * 1000 > Date.now()) {
            const profile = await api.getUserProfile();
            setUser(profile);
            setIsLoginView(false);
          } else {
            await setAuthToken(null);
          }
        }
      } catch {
        await setAuthToken(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []));

  const handleAuth = async (values) => {
    setIsLoading(true);
    try {
      const method = isLoginView ? api.login : api.register;
      const res = await method(values.email, values.password, values.username);
      if (res.token) {
        await setAuthToken(res.token);
        setUser(res.user);
        setIsLoginView(false);
      }
    } catch (err) {
      console.error('Auth failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await api.logout();
    setUser(null);
    setIsLoginView(true);
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.outermostContainer}
    >
      <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        {user ? (
          <View style={styles.profileBox}>
            <Text style={styles.title}>Welcome, {user.username}</Text>
            <TouchableOpacity style={styles.button} onPress={handleSignOut}>
              <Text style={styles.buttonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formBox}>
            <Text style={styles.title}>{isLoginView ? 'Login' : 'Create Account'}</Text>
            <AuthForm isLoginView={isLoginView} handleSubmit={handleAuth} isSubmitting={isLoading} />
            <TouchableOpacity onPress={() => setIsLoginView(!isLoginView)} style={styles.toggleAuth}>
              <Text style={styles.toggleAuthText}>
                {isLoginView ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  outermostContainer: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  contentContainer: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    width: '100%',
    height: 50,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  errorText: {
    color: '#ff7675',
    marginBottom: 8,
    width: '100%',
  },
  button: {
    backgroundColor: COLORS.accent,
    padding: 14,
    borderRadius: 8,
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleAuth: {
    marginTop: 20,
  },
  toggleAuthText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  formBox: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  profileBox: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 20,
    borderRadius: 10,
  },
});

export default ProfileScreen;
