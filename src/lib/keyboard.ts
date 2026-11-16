/**
 * Clavier, sans module natif.
 *
 * react-native-keyboard-controller (version Expo 54, 1.18.5) dépend de
 * Reanimated 4, et Reanimated 4 interrompt l'installation iOS dès que
 * RCT_NEW_ARCH_ENABLED vaut 0. L'app garde newArchEnabled à false : on
 * reste sur KeyboardAvoidingView (padding sur les deux plateformes) et
 * useHeaderHeight() pour le décalage. On ne règle pas
 * softwareKeyboardLayoutMode sur « pan » en même temps que ce padding.
 */
import { useEffect, useState } from 'react';
import { Keyboard, Platform, type ScrollViewProps } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';

/** interactive sur iOS, on-drag sur Android. */
export const keyboardDismissMode: NonNullable<ScrollViewProps['keyboardDismissMode']> =
  Platform.OS === 'ios' ? 'interactive' : 'on-drag';

/**
 * Hauteur du header de navigation. 0 si l'écran n'a pas de header
 * (le hook lève une erreur hors d'un navigateur).
 */
export function useKeyboardVerticalOffset(): number {
  try {
    return useHeaderHeight();
  } catch {
    return 0;
  }
}

/** Hauteur du clavier, pour garder la dernière ligne d'une liste visible. */
export function useKeyboardInset(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
