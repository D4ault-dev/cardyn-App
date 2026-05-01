import { RF } from '../util/responsive'
import React, { ReactNode } from 'react'
import { TouchableOpacity, Text, StyleProp, ViewStyle, TextStyle } from 'react-native'
import Colors from "../constants/Colors"

export default function Button(props: {
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  children?: string | ReactNode
  onPress?: () => void
}) {
  return (
    <TouchableOpacity
      onPress={props.onPress}
      style={[{
        borderRadius: 17,
        backgroundColor: Colors.blue,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
      }, props.style]}
    >
      {typeof props.children === "string"
        ? <Text style={[{ fontWeight: "600", color: Colors.white, fontSize: RF(18) }, props.textStyle]}>{props.children}</Text>
        : props.children
      }
    </TouchableOpacity>
  )
}
