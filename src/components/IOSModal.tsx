import React from 'react';
import { View, Text, Modal, TouchableOpacity, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import useThemeStore from '../lib/zustand/themeStore';

interface Action {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
}

interface IOSModalProps {
    visible: boolean;
    title: string;
    message: string;
    actions: Action[];
    onClose: () => void; // Called when requesting close (e.g. background tap)
}

const IOSModal: React.FC<IOSModalProps> = ({ visible, title, message, actions, onClose }) => {
    // Separate 'cancel' actions from others effectively if we want the split look
    // The provided image shows stacked buttons with one separate at the bottom often being cancel.
    // However, the image specifically shows: Message block + Stacked Buttons + Cancel Button isolated.

    const cancelAction = actions.find(a => a.style === 'cancel');
    const otherActions = actions.filter(a => a.style !== 'cancel');
    const { primary } = useThemeStore(state => state);

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center bg-black/50 pb-0 px-4">
                {/* Main Content Block */}
                <BlurView
                    intensity={90}
                    tint="systemMaterialDark"
                    className="w-full max-w-[400px] rounded-xl overflow-hidden bg-zinc-900/95 mb-2"
                    style={{ overflow: 'hidden' }}
                >
                    <View className="items-center py-4 px-4 border-b border-white/10">
                        <Text
                            className="text-[17px] font-bold text-center leading-6 mb-1"
                            style={{ color: primary }}
                        >
                            {title}
                        </Text>
                        {message ? (
                            <Text className="text-white/60 text-[13px] mt-1 text-center leading-4">
                                {message}
                            </Text>
                        ) : null}
                    </View>

                    {otherActions.map((action, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={action.onPress}
                            activeOpacity={0.7}
                            className={`w-full py-4 items-center justify-center active:bg-white/10 ${index > 0 ? 'border-t border-white/10' : ''}`}
                        >
                            <Text
                                className={`text-[20px] font-normal ${action.style === 'destructive' ? 'text-red-500' : ''}`}
                                style={action.style !== 'destructive' ? { color: primary } : {}}
                            >
                                {action.text}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </BlurView>

                {/* Separated Cancel Button */}
                {cancelAction && (
                    <TouchableOpacity
                        onPress={cancelAction.onPress}
                        activeOpacity={0.8}
                        className="w-full max-w-[400px] rounded-xl overflow-hidden mt-1"
                    >
                        <BlurView
                            intensity={90}
                            tint="systemMaterialDark"
                            className="w-full py-4 items-center justify-center bg-zinc-800/95"
                        >
                            <Text
                                className="text-[20px] font-semibold"
                                style={{ color: primary }}
                            >
                                {cancelAction.text}
                            </Text>
                        </BlurView>
                    </TouchableOpacity>
                )}
            </View>
        </Modal>
    );
};

export default IOSModal;
