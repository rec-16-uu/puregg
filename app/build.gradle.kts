plugins {
    id("com.android.application")
}

// 签名信息放在 gitignore 的 keystore.properties 里（不提交到仓库）。
// 首次构建时由 tools/build-apk.ps1 生成；本地没有该文件时 release 不签名。
val keystoreProps = rootProject.file("keystore.properties")
    .takeIf { it.exists() }
    ?.readLines()
    ?.mapNotNull { line ->
        val i = line.indexOf('=')
        if (i > 0) line.substring(0, i).trim() to line.substring(i + 1).trim() else null
    }
    ?.toMap() ?: emptyMap()

android {
    namespace = "com.purpleegg.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.purpleegg.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        if (keystoreProps["storeFile"] != null) {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getValue("storeFile"))
                storePassword = keystoreProps.getValue("storePassword")
                keyAlias = keystoreProps.getValue("keyAlias")
                keyPassword = keystoreProps.getValue("keyPassword")
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (keystoreProps["storeFile"] != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}
