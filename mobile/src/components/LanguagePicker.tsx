import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  FlatList,
} from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

interface LanguagePickerProps {
  visible: boolean;
  onClose: () => void;
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({ visible, onClose }) => {
  const { language, setLanguage, t } = useLanguage();

  const languageOptions = [
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
  ];

  const handleLanguageSelect = async (languageCode: 'en' | 'zh') => {
    await setLanguage(languageCode);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{t('common.language', 'Language')}</Text>

          <FlatList
            data={languageOptions}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.option,
                  language === item.code && styles.optionSelected,
                ]}
                onPress={() => handleLanguageSelect(item.code as 'en' | 'zh')}
              >
                <Text
                  style={[
                    styles.optionText,
                    language === item.code && styles.optionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {language === item.code && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            )}
            scrollEnabled={false}
          />

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>{t('common.close', 'Close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 20,
    width: '80%',
    maxWidth: 300,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  optionSelected: {
    backgroundColor: '#EBF5FB',
  },
  optionText: {
    fontSize: 16,
    color: '#2C3E50',
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: 'bold',
    color: '#2980B9',
  },
  checkmark: {
    fontSize: 18,
    color: '#2980B9',
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '600',
  },
});
