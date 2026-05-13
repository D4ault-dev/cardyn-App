import React from 'react'
import {
  View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius } from '../../theme'

interface Props {
  cardImages: string[]
  uploadingImage: boolean
  attempted: boolean
  onAddImage: () => void
  onRemoveImage: (idx: number) => void
  onViewImage: (idx: number) => void
  onViewGuide: () => void
}

export function ImageUploadSection({
  cardImages, uploadingImage, attempted,
  onAddImage, onRemoveImage, onViewImage, onViewGuide,
}: Props) {
  return (
    <>
      <Text style={s.sectionLabel}>Upload card image</Text>

      <View style={s.imagesRow}>
        {/* Existing thumbnails */}
        {cardImages.map((uri, idx) => (
          <TouchableOpacity
            key={uri}
            style={s.imageThumbnailWrap}
            onPress={() => onViewImage(idx)}
            activeOpacity={0.9}>
            <Image
              source={{ uri }}
              style={{ width: 64, height: 64, borderRadius: radius.md }}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={s.imageThumbnailRemove}
              onPress={() => onRemoveImage(idx)}>
              <Feather name="x" size={10} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* Add button */}
        <TouchableOpacity style={s.imageAddBtn} onPress={onAddImage} activeOpacity={0.8}>
          {uploadingImage ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Feather name="camera" size={18} color={colors.muted} />
              <Text style={s.imageAddTxt}>Add</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Inline error — only after submit attempt */}
      {attempted && cardImages.length === 0 && (
        <View style={s.inlineError}>
          <Feather name="alert-circle" size={13} color={colors.error} />
          <Text style={s.inlineErrorTxt}>Upload at least 1 image to continue</Text>
        </View>
      )}

      <TouchableOpacity onPress={onViewGuide} activeOpacity={0.7}>
        <Text style={s.uploadHelpTxt}>Need help? View sample images.</Text>
      </TouchableOpacity>
    </>
  )
}

const s = StyleSheet.create({
  sectionLabel: {
    fontSize: typography.size.lg, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[2],
  },
  imagesRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3],
  },
  imageThumbnailWrap: {
    width: 64, height: 64, borderRadius: radius.md,
    overflow: 'hidden', position: 'relative',
  },
  imageThumbnailRemove: {
    position: 'absolute', top: 3, right: 3,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageAddBtn: {
    width: 64, height: 64, borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: spacing[1],
  },
  imageAddTxt: {
    fontSize: typography.size.xs, color: colors.muted, fontWeight: typography.weight.medium,
  },
  inlineError: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 2,
    marginBottom: spacing[2],
  },
  inlineErrorTxt: {
    fontSize: typography.size.xs, color: colors.error,
    fontWeight: typography.weight.medium, flex: 1,
  },
  uploadHelpTxt: {
    fontSize: typography.size.xs, color: colors.muted,
    fontWeight: typography.weight.regular, marginBottom: spacing[3], lineHeight: 18,
  },
})
