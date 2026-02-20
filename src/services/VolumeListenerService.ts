import { VolumeManager } from 'react-native-volume-manager';
import type { EmitterSubscription } from 'react-native';

type ShutterCallback = () => void;

export class VolumeListenerService {
    private subscription: EmitterSubscription | null = null;
    private listeners: Set<ShutterCallback> = new Set();
    private isListening = false;

    startListening() {
        if (this.isListening) return;
        this.isListening = true;

        // Listen for volume changes. Bluetooth remotes usually trigger volume up or down.
        this.subscription = VolumeManager.addVolumeListener((result) => {
            // Depending on the OS, we just detect that the volume changed.
            // Some remotes trigger specific button events, but VolumeManager captures the change.
            this.notifyListeners();

            // To prevent volume from maxing out or hitting zero, we could programmatically set it to 0.5
            // But for now, just detecting the change is enough to trigger the shutter.
            // VolumeManager.setVolume(0.5); 
        });
    }

    stopListening() {
        if (!this.isListening) return;
        this.isListening = false;
        this.subscription?.remove();
        this.subscription = null;
    }

    addListener(callback: ShutterCallback) {
        this.listeners.add(callback);
    }

    removeListener(callback: ShutterCallback) {
        this.listeners.delete(callback);
    }

    private notifyListeners() {
        this.listeners.forEach(cb => cb());
    }
}

export const volumeListenerService = new VolumeListenerService();
