# Release Keystore Credentials

**⚠️ NON PERDERE QUESTE CREDENZIALI — servono per ogni aggiornamento su Play Store.**

| Campo | Valore |
|-------|--------|
| **Keystore file** | `android/app/release.keystore` |
| **Store password** | *(stored in `android/gradle.properties`, NOT tracked by git)* |
| **Key alias** | `agmente-release` |
| **Key password** | *(stored in `android/gradle.properties`, NOT tracked by git)* |
| **CN** | Giulio Leone |
| **O** | Gauss |
| **Validity** | 10.000 giorni (~27 anni) |

## Setup per nuova macchina

1. Copia `android/app/release.keystore` dalla posizione sicura
2. Crea `android/gradle.properties` con:
   ```properties
   RELEASE_STORE_PASSWORD=<password>
   RELEASE_KEY_ALIAS=agmente-release
   RELEASE_KEY_PASSWORD=<password>
   ```
3. **MAI committare** `gradle.properties` o il keystore nel repository
