import { RF } from '../util/responsive'
import { getStatusBarHeight } from '../util/statusBar'
import React, { ReactNode } from 'react'
import { View, Text, Platform } from 'react-native'

export default function Header(props: {
  children?: ReactNode
  title: string | ReactNode
  right?: ReactNode
}) {
  return (
    <View style={{ paddingTop: getStatusBarHeight() }}>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {typeof props.title === "string"
            ? <Text style={{ fontWeight: "600", fontSize: RF(32), marginBottom: 10 }}>{props.title}</Text>
            : props.title
          }
          {props.right}
        </View>
        {props.children}
      </View>
    </View>
  )
}
