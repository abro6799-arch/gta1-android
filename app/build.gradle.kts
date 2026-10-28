plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.example.gta1launcher"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.gta1launcher"
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "0.2.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    // The WASM emulator and zip library are large and already compressed.
    androidResources {
        noCompress += listOf("wasm", "js", "css", "html")
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("androidx.webkit:webkit:1.11.0")
}

// Fail early with a clear message if the web dependencies were not fetched.
tasks.register("checkWebDeps") {
    doLast {
        val needed = listOf("vendor/js-dos.js", "vendor/js-dos.css", "vendor/jszip.min.js")
        val dir = file("src/main/assets/web")
        val missing = needed.filter { !File(dir, it).exists() }
        if (missing.isNotEmpty()) {
            throw GradleException(
                "Missing web dependencies: $missing. Run `node scripts/fetch-deps.js` first."
            )
        }
    }
}
tasks.matching { it.name == "preBuild" }.configureEach { dependsOn("checkWebDeps") }
