import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import colors from '@/constants/colors';
import { useCloudApp, type CloudPhoto } from '@/context/CloudContext';
import { useMediaSync } from '@/hooks/useMediaSync';
import {
  fetchGalleryPage,
  fetchMediaDownloadUrl,
  isMediaApiConfigured,
  type GalleryMedia,
} from '@/services/mediaGalleryApi';

type Filter = 'all' | 'photo' | 'video' | 'mine';
type DisplayMedia = GalleryMedia | (CloudPhoto & { mediaType: 'photo'; status: 'completed'; thumbnailPath: string; ownerId: string; filename: string; });
const c = colors.light;

function formatStatus(status: ReturnType<typeof useMediaSync>['status']): string {
  switch (status) {
    case 'permission_required': return 'Permission required';
    case 'scanning': return 'Scanning your gallery';
    case 'active': return 'Sync ready';
    case 'paused': return 'Sync paused';
    case 'complete': return 'Up to date';
    default: return 'Media Sync is off';
  }
}

function SyncCard() {
  const { status, settings, summary, isBusy, error, enableSync, setSyncPaused, updateSettings } = useMediaSync();
  return (
    <View style={styles.syncCard}>
      <View style={styles.syncHeading}>
        <View style={styles.syncIcon}><Feather name="refresh-cw" size={18} color={c.primary} /></View>
        <View style={styles.syncCopy}>
          <Text style={styles.syncTitle}>Media Sync</Text>
          <Text style={styles.syncStatus}>{formatStatus(status)}</Text>
        </View>
        {settings.enabled && <View style={[styles.statusDot, status === 'paused' && styles.statusDotPaused]} />}
      </View>
      {!settings.enabled ? (
        <>
          <Text style={styles.syncBody}>Automatically find the photos and videos Android allows Private World to access. Nothing uploads until you enable this and grant permission.</Text>
          <Pressable disabled={isBusy} onPress={() => void enableSync()} style={styles.primaryButton}>
            {isBusy ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="shield" size={16} color="#fff" />}
            <Text style={styles.primaryButtonText}>{isBusy ? 'Checking access…' : 'Enable Media Sync'}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.progressRow}><Text style={styles.progressLabel}>Queued media</Text><Text style={styles.progressValue}>{summary.completed} / {summary.total || '—'}</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${summary.total ? Math.min(summary.completed / summary.total, 1) * 100 : 0}%` }]} /></View>
          <Text style={styles.syncBody}>{summary.failed ? `${summary.failed} item${summary.failed === 1 ? '' : 's'} need attention.` : status === 'paused' ? 'Resume whenever you are ready.' : 'New media will be discovered when Android permits background work.'}</Text>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.syncActions}>
            <Pressable disabled={isBusy} onPress={() => void setSyncPaused(!settings.paused)} style={styles.secondaryButton}><Feather name={settings.paused ? 'play' : 'pause'} size={15} color={c.primary} /><Text style={styles.secondaryButtonText}>{settings.paused ? 'Resume Sync' : 'Pause Sync'}</Text></Pressable>
            <View style={styles.settingRow}><Text style={styles.settingLabel}>Wi-Fi only</Text><Switch value={settings.wifiOnly} onValueChange={(value) => void updateSettings({ wifiOnly: value })} trackColor={{ false: c.border, true: '#e3aabd' }} thumbColor={settings.wifiOnly ? c.primary : '#fff'} /></View>
          </View>
        </>
      )}
    </View>
  );
}

function MediaTile({ item, onOpen }: { item: DisplayMedia; onOpen: (item: DisplayMedia) => void }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if ('thumbnailPath' in item && item.thumbnailPath) {
      void fetchMediaDownloadUrl(item.id, true).then((url) => { if (active) setThumbnailUrl(url); }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [item]);
  return (
    <Pressable onPress={() => onOpen(item)} style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
      {thumbnailUrl ? <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} /> : <View style={styles.thumbnailPlaceholder}><Feather name={item.mediaType === 'video' ? 'play-circle' : 'image'} size={26} color={c.primary} /></View>}
      {item.mediaType === 'video' && <View style={styles.videoBadge}><Feather name="play" size={11} color="#fff" /></View>}
      {item.status !== 'completed' && <View style={styles.uploadBadge}><Feather name="upload-cloud" size={11} color="#fff" /></View>}
    </Pressable>
  );
}

function Viewer({ item, onClose }: { item: DisplayMedia | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (item && 'storagePath' in item) void fetchMediaDownloadUrl(item.id, false).then((value) => { if (active) setUrl(value); }).catch(() => undefined);
    else if (item) setUrl(item.url);
    return () => { active = false; };
  }, [item]);
  return <Modal animationType="fade" visible={!!item} onRequestClose={onClose} transparent><View style={styles.viewer}><Pressable onPress={onClose} style={styles.closeButton}><Feather name="x" size={22} color="#fff" /></Pressable>{url ? item?.mediaType === 'video' ? <Video source={{ uri: url }} style={styles.viewerMedia} useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay /> : <Image source={{ uri: url }} style={styles.viewerMedia} resizeMode="contain" /> : <ActivityIndicator color="#fff" size="large" />}</View></Modal>;
}

export default function OurMemoriesScreen({ openComposer, legacyPhotos, onLegacyOpen }: { openComposer: () => void; legacyPhotos: CloudPhoto[]; onLegacyOpen: (photo: CloudPhoto) => void }) {
  const { currentUser } = useCloudApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<GalleryMedia[]>([]);
  const [legacyItems, setLegacyItems] = useState<CloudPhoto[]>(legacyPhotos);
  const [loading, setLoading] = useState(isMediaApiConfigured);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<DisplayMedia | null>(null);

  const load = useCallback(async (reset = true) => {
    if (!isMediaApiConfigured) {
      setLegacyItems(legacyPhotos);
      return;
    }
    setLoading(true);
    try {
      const page = await fetchGalleryPage({
        offset: reset ? 0 : items.length,
        mediaType: filter === 'photo' || filter === 'video' ? filter : undefined,
        ownerId: filter === 'mine' ? currentUser?.id : undefined,
      });
      setItems((current) => reset ? page.items : [...current, ...page.items]);
      setHasMore(page.offset + page.items.length < page.total);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id, filter, items.length, legacyPhotos]);

  useEffect(() => { void load(); }, [filter]);

  const displayed = isMediaApiConfigured ? items : legacyItems.map((photo) => ({ ...photo, mediaType: 'photo' as const, status: 'completed' as const, thumbnailPath: '', ownerId: photo.uploadedBy, filename: photo.caption }));
  return <View style={styles.root}>
    <FlatList<DisplayMedia>
      data={displayed}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.columns}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={c.primary} />}
      onEndReached={() => { if (hasMore && !loading) void load(false); }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={<><View style={styles.pageHeading}><View><Text style={styles.eyebrow}>Private shared album</Text><Text style={styles.pageTitle}>❤️ Our Memories</Text></View><Pressable onPress={openComposer} style={styles.addButton}><Feather name="plus" size={18} color={c.primary} /></Pressable></View><Text style={styles.description}>Everyday moments from both of your Android galleries, kept safely in your little world.</Text><SyncCard /><View style={styles.filterRow}>{(['all', 'photo', 'video', 'mine'] as Filter[]).map((value) => <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === 'all' ? 'All' : value === 'photo' ? 'Photos' : value === 'video' ? 'Videos' : 'Mine'}</Text></Pressable>)}</View></>}
      ListEmptyComponent={loading ? <ActivityIndicator color={c.primary} style={styles.emptyLoader} /> : <View style={styles.empty}><Feather name="image" size={26} color={c.primary} /><Text style={styles.emptyTitle}>{isMediaApiConfigured ? 'Your shared gallery is waiting' : 'No photos yet'}</Text><Text style={styles.emptyText}>{isMediaApiConfigured ? 'Enable Media Sync to discover Android-authorized media.' : 'Add a photo to begin your shared album.'}</Text></View>}
      renderItem={({ item }) => <MediaTile item={item} onOpen={(value) => { if ('storagePath' in value) setSelected(value); else onLegacyOpen(value); }} />}
      ListFooterComponent={loading && items.length > 0 ? <ActivityIndicator color={c.primary} style={styles.footerLoader} /> : null}
    />
    <Viewer item={selected} onClose={() => setSelected(null)} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, listContent: { padding: 20, paddingBottom: 42 }, columns: { gap: 10 }, pageHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, eyebrow: { color: c.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }, pageTitle: { color: c.foreground, fontSize: 25, fontWeight: '800', marginTop: 4 }, description: { color: c.mutedForeground, fontSize: 13, lineHeight: 19, marginBottom: 16, marginTop: 6 }, addButton: { alignItems: 'center', backgroundColor: c.secondary, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, syncCard: { backgroundColor: '#fff', borderColor: c.border, borderRadius: 21, borderWidth: 1, marginBottom: 16, padding: 16 }, syncHeading: { alignItems: 'center', flexDirection: 'row' }, syncIcon: { alignItems: 'center', backgroundColor: c.secondary, borderRadius: 16, height: 34, justifyContent: 'center', width: 34 }, syncCopy: { flex: 1, marginLeft: 10 }, syncTitle: { color: c.foreground, fontSize: 15, fontWeight: '800' }, syncStatus: { color: c.mutedForeground, fontSize: 11, marginTop: 2 }, statusDot: { backgroundColor: '#5ca56e', borderRadius: 5, height: 10, width: 10 }, statusDotPaused: { backgroundColor: '#d39a57' }, syncBody: { color: c.mutedForeground, fontSize: 12, lineHeight: 18, marginTop: 11 }, primaryButton: { alignItems: 'center', backgroundColor: c.primary, borderRadius: 13, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 14, paddingVertical: 11 }, primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' }, progressRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }, progressLabel: { color: c.mutedForeground, fontSize: 11, fontWeight: '700' }, progressValue: { color: c.foreground, fontSize: 12, fontWeight: '800' }, progressTrack: { backgroundColor: c.secondary, borderRadius: 4, height: 7, marginTop: 8, overflow: 'hidden' }, progressFill: { backgroundColor: c.primary, borderRadius: 4, height: 7 }, syncActions: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 13 }, secondaryButton: { alignItems: 'center', borderColor: '#e4bdca', borderRadius: 11, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 8 }, secondaryButtonText: { color: c.primary, fontSize: 11, fontWeight: '800' }, settingRow: { alignItems: 'center', flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }, settingLabel: { color: c.mutedForeground, fontSize: 10, marginRight: 4 }, errorText: { color: '#b34f63', fontSize: 11, lineHeight: 16, marginTop: 8 }, filterRow: { flexDirection: 'row', gap: 7, marginBottom: 12 }, filter: { backgroundColor: '#fff', borderColor: c.border, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, filterActive: { backgroundColor: c.primary, borderColor: c.primary }, filterText: { color: c.mutedForeground, fontSize: 11, fontWeight: '700' }, filterTextActive: { color: '#fff' }, tile: { backgroundColor: '#fff', borderColor: c.border, borderRadius: 16, borderWidth: 1, flex: 1, maxWidth: '50%', overflow: 'hidden' }, tilePressed: { opacity: 0.82 }, thumbnail: { aspectRatio: 1, backgroundColor: c.secondary, width: '100%' }, thumbnailPlaceholder: { alignItems: 'center', aspectRatio: 1, backgroundColor: '#f4e8ed', justifyContent: 'center', width: '100%' }, videoBadge: { alignItems: 'center', backgroundColor: '#0009', borderRadius: 14, bottom: 8, height: 28, justifyContent: 'center', left: 8, position: 'absolute', width: 28 }, uploadBadge: { alignItems: 'center', backgroundColor: '#c3874f', borderRadius: 14, bottom: 8, height: 28, justifyContent: 'center', right: 8, position: 'absolute', width: 28 }, empty: { alignItems: 'center', backgroundColor: '#fff', borderColor: c.border, borderRadius: 20, borderWidth: 1, marginTop: 5, padding: 26 }, emptyTitle: { color: c.foreground, fontSize: 15, fontWeight: '800', marginTop: 10 }, emptyText: { color: c.mutedForeground, fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: 'center' }, emptyLoader: { marginTop: 32 }, footerLoader: { marginVertical: 20 }, viewer: { alignItems: 'center', backgroundColor: '#130d12f2', flex: 1, justifyContent: 'center' }, closeButton: { padding: 12, position: 'absolute', right: 16, top: 42, zIndex: 2 }, viewerMedia: { height: '85%', width: '100%' },
});
