import { RF } from '../util/responsive'
import React from 'react'
import { StyleProp, TextInput, TextInputProps, ViewStyle } from "react-native"
import Colors from "../constants/Colors"

export default function Input(props: {
  onChangeText: (str: string) => void
  placeholder: string
  style?: StyleProp<ViewStyle>
  secureTextEntry?: boolean
  textInputProps?: Omit<TextInputProps, "style" | "onChangeText">
}) {
  return (
    <TextInput
      autoCapitalize="none"
      style={[{
        paddingVertical: 14,
        backgroundColor: Colors.lightgray,
        borderRadius: 17,
        fontSize: RF(18),
        paddingHorizontal: 20,
      }, props.style]}
      placeholderTextColor={Colors.placeholder}
      placeholder={props.placeholder}
      onChangeText={props.onChangeText}
      secureTextEntry={props.secureTextEntry}
      {...props.textInputProps}
    />
  )
}
