# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# react-native-svg
-keep public class com.horcrux.svg.** { *; }

# expo-secure-store
-keep class expo.modules.securestore.** { *; }

# expo modules
-keep class expo.modules.** { *; }
-keepclassmembers class * { @expo.modules.kotlin.* *; }

# OkHttp (used by RN networking)
-dontwarn okhttp3.**
-dontwarn okio.**

# Keep JS interface
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
