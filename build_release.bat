@echo off
set JAVA_HOME=E:\jdk21\jdk-21.0.6+7
set ANDROID_HOME=E:\android-sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%
E:
cd "E:\StuSta Gym App\android"
echo Building release AAB...
"E:\StuSta Gym App\android\gradlew.bat" bundleRelease
echo EXIT_CODE=%ERRORLEVEL%
