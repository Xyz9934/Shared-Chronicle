import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCloudApp, type CloudLetter, type CloudMemory, type CloudPhoto, type CloudTimelineEntry } from '@/context/CloudContext';
import colors from '@/constants/colors';
import { subscribeToNotificationResponses } from '@/services/notifications';

const c = colors.light;
type Icon = keyof typeof Feather.glyphMap;
type Section = 'home' | 'chat' | 'memories' | 'gallery' | 'timeline' | 'letters' | 'music';
type ComposerKind = 'memory' | 'photo' | 'timeline' | 'letter' | 'song' | null;

const today = () => new Date().toISOString().slice(0, 10);
const niceDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const niceTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

function Mark({ size = 44 }: { size?: number }) {
  return (
    <LinearGradient colors={['#d97895', '#b74d70']} style={{ width: size, height: size, borderRadius: size * 0.34, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name="heart" size={size * 0.42} color="#fff9f7" />
    </LinearGradient>
  );
}

function Button({ title, icon, onPress, ghost = false, disabled = false }: { title: string; icon?: Icon; onPress: () => void; ghost?: boolean; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, ghost && styles.buttonGhost, disabled && styles.buttonDisabled, pressed && styles.pressed]}>
      {icon && <Feather name={icon} size={16} color={ghost ? c.primary : '#fff'} />}
      <Text style={[styles.buttonText, ghost && styles.buttonGhostText]}>{title}</Text>
    </Pressable>
  );
}

function IconButton({ icon, label, onPress, color = c.foreground }: { icon: Icon; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Feather name={icon} size={19} color={color} />
    </Pressable>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline = false, secureTextEntry = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; secureTextEntry?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="sentences"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
      />
    </View>
  );
}

function Sheet({ visible, title, eyebrow, onClose, children }: { visible: boolean; title: string; eyebrow?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView behavior="padding" style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
              <Text style={styles.sheetTitle}>{title}</Text>
            </View>
            <IconButton icon="x" label="Close" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Empty({ icon, title, body }: { icon: Icon; title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Feather name={icon} size={22} color={c.primary} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function Login() {
  const { login, error, isFirebaseConfigured } = useCloudApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    Keyboard.dismiss();
    setBusy(true);
    await login(username, password);
    setBusy(false);
  };
  return (
    <LinearGradient colors={['#fff9f7', '#f9e9ed', '#eee6f6']} style={styles.login}>
      <View style={styles.loginGlow} />
      <View style={styles.loginContent}>
        <Mark size={66} />
        <Text style={styles.eyebrow}>A space for two</Text>
        <Text style={styles.loginTitle}>Welcome back{'\n'}to your little world.</Text>
        <Text style={styles.loginSub}>A quiet place for the words, photos, and moments that belong to you both.</Text>
        <View style={styles.loginCard}>
          <Field label="Username" value={username} onChangeText={setUsername} placeholder="tommy or jerry" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="Your private password" secureTextEntry />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button title={busy ? 'Opening your space…' : 'Enter privately'} icon="arrow-right" onPress={() => void submit()} disabled={busy || !isFirebaseConfigured} />
          <View style={styles.secureNote}><Feather name="shield" size={14} color={c.primary} /><Text style={styles.secureText}>{isFirebaseConfigured ? 'Encrypted cloud sync for exactly two people.' : 'Firebase configuration is required before entering.'}</Text></View>
        </View>
      </View>
      <Text style={styles.loginFooter}>Private by design · Firebase cloud sync</Text>
    </LinearGradient>
  );
}

function Header({ onSettings, onLogout }: { onSettings: () => void; onLogout: () => void }) {
  const { currentUser } = useCloudApp();
  return (
    <View style={styles.header}>
      <View style={styles.identity}><Mark /><View><Text style={styles.brand}>private world</Text><Text style={styles.brandCaption}>just the two of you</Text></View></View>
      <View style={styles.headerActions}>
        {currentUser?.role === 'OWNER' && <IconButton icon="sliders" label="Owner customization" onPress={onSettings} color={c.primary} />}
        <Pressable onPress={onLogout} accessibilityLabel="Sign out" style={styles.avatar}><Text style={styles.avatarText}>{currentUser?.initials ?? '?'}</Text></Pressable>
      </View>
    </View>
  );
}

function Navigation({ section, onChange, unread }: { section: Section; onChange: (section: Section) => void; unread: number }) {
  const items: Array<{ key: Section; label: string; icon: Icon }> = [
    { key: 'home', label: 'Home', icon: 'home' }, { key: 'chat', label: 'Chat', icon: 'message-circle' },
    { key: 'memories', label: 'Memories', icon: 'book-open' }, { key: 'gallery', label: 'Gallery', icon: 'image' },
    { key: 'timeline', label: 'Timeline', icon: 'clock' }, { key: 'letters', label: 'Letters', icon: 'mail' },
    { key: 'music', label: 'Music', icon: 'music' },
  ];
  return (
    <ScrollView horizontal style={styles.navScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
      {items.map((item) => {
        const active = section === item.key;
        return <Pressable key={item.key} onPress={() => onChange(item.key)} style={[styles.navItem, active && styles.navItemActive]}>
          <View style={styles.navIcon}><Feather name={item.icon} size={16} color={active ? c.primary : c.mutedForeground} />{item.key === 'chat' && unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>}</View>
          <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
        </Pressable>;
      })}
    </ScrollView>
  );
}

function Home({ go, openComposer }: { go: (section: Section) => void; openComposer: (kind: Exclude<ComposerKind, null>) => void }) {
  const { currentUser, settings, messages, memories, photos, letters, songs } = useCloudApp();
  const [revealed, setRevealed] = useState(false);
  const latest = memories[0];
  const unread = messages.filter((item) => item.senderId !== currentUser?.id && !item.readBy.includes(currentUser?.id ?? '')).length;
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.greetingRow}><View><Text style={styles.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</Text><Text style={styles.greeting}>Good to see you, {currentUser?.name}</Text></View><View style={styles.syncPill}><View style={styles.syncDot} /><Text style={styles.syncText}>Live sync</Text></View></View>
      <LinearGradient colors={[settings?.themePrimary || '#d67693', '#b84f72']} style={styles.hero}>
        <View style={styles.heroOrb} /><View style={styles.heroCopy}><View style={styles.heroIcon}><Feather name="heart" size={18} color="#fff" /></View><Text style={styles.heroKicker}>A note for today</Text><Text style={styles.heroTitle}>{settings?.greeting || 'The ordinary moments are the ones we keep.'}</Text><Text style={styles.heroCaption}>Your private world is growing softly, one little moment at a time.</Text></View>
      </LinearGradient>
      <Text style={styles.sectionTitle}>Make it yours</Text>
      <View style={styles.quickGrid}>
        {([{ icon: 'book-open', label: 'Memory', kind: 'memory', tint: '#b54d71' }, { icon: 'camera', label: 'Photo', kind: 'photo', tint: '#8061a0' }, { icon: 'message-circle', label: 'Message', kind: null, tint: '#5d8a86' }, { icon: 'music', label: 'Song', kind: 'song', tint: '#c3874f' }] as Array<{ icon: Icon; label: string; kind: Exclude<ComposerKind, null> | null; tint: string }>).map((item) => <Pressable key={item.label} onPress={() => item.kind ? openComposer(item.kind) : go('chat')} style={styles.quick}><View style={[styles.quickIcon, { backgroundColor: `${item.tint}18` }]}><Feather name={item.icon} size={21} color={item.tint} /></View><Text style={styles.quickLabel}>{item.label}</Text></Pressable>)}
      </View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{settings?.memoriesTitle || 'Latest memory'}</Text><Pressable onPress={() => go('memories')}><Text style={styles.link}>See all</Text></Pressable></View>
      {latest ? <MemoryTile memory={latest} compact /> : <Empty icon="book-open" title="Your first memory is waiting" body="Save something small from today." />}
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Inside your world</Text><Text style={styles.muted}>at a glance</Text></View>
      <View style={styles.stats}><Stat icon="message-circle" value={String(messages.length)} label={unread ? `${unread} unread` : 'messages'} onPress={() => go('chat')} /><Stat icon="image" value={String(photos.length)} label="photos" onPress={() => go('gallery')} /><Stat icon="mail" value={String(letters.length)} label="letters" onPress={() => go('letters')} /><Stat icon="music" value={String(songs.length)} label="songs" onPress={() => go('music')} /></View>
      {settings?.secretMessage ? <Pressable onPress={() => setRevealed((value) => !value)} style={styles.secretCard}><View style={styles.secretIcon}><Feather name={revealed ? 'unlock' : 'lock'} size={18} color={c.primary} /></View><View style={{ flex: 1 }}><Text style={styles.secretKicker}>A secret for you</Text><Text style={styles.secretText}>{revealed ? settings.secretMessage : 'Tap to reveal what is hidden here.'}</Text></View><Feather name="chevron-right" size={18} color={c.mutedForeground} /></Pressable> : null}
      {messages[messages.length - 1] && <Pressable onPress={() => go('chat')} style={styles.lastMessage}><View style={styles.messageIcon}><Feather name="message-circle" size={18} color={c.primary} /></View><View style={{ flex: 1 }}><Text style={styles.lastLabel}>Last note from {messages[messages.length - 1].senderName}</Text><Text numberOfLines={1} style={styles.lastText}>{messages[messages.length - 1].text}</Text></View><Feather name="chevron-right" size={18} color={c.mutedForeground} /></Pressable>}
    </ScrollView>
  );
}

function Stat({ icon, value, label, onPress }: { icon: Icon; value: string; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.stat, pressed && styles.pressed]}><Feather name={icon} size={18} color={c.primary} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></Pressable>;
}

function Chat() {
  const { currentUser, messages, sendMessage, markMessageRead } = useCloudApp();
  const [draft, setDraft] = useState('');
  useEffect(() => {
    if (!currentUser) return;
    messages.filter((item) => item.senderId !== currentUser.id && !item.readBy.includes(currentUser.id)).forEach((item) => {
      void markMessageRead(item.id);
    });
  }, [messages, currentUser?.id]);
  const submit = async () => { if (!draft.trim()) return; const text = draft; setDraft(''); await sendMessage(text); };
  return <KeyboardAvoidingView behavior="padding" style={styles.chat}><View style={styles.chatIntro}><View style={styles.chatAvatar}><Feather name="heart" size={18} color={c.primary} /></View><View><Text style={styles.pageTitle}>Just between us</Text><Text style={styles.pageDescription}>Your private conversation · live synced</Text></View></View>
    <FlatList data={[...messages].reverse()} inverted keyExtractor={(item) => item.id} contentContainerStyle={styles.messageList} showsVerticalScrollIndicator={false} renderItem={({ item }) => {
      const mine = item.senderId === currentUser?.id; const unread = !mine && !item.readBy.includes(currentUser?.id ?? '');
      return <Pressable onPress={() => !mine && void markMessageRead(item.id)} style={[styles.messageRow, mine && styles.messageRowMine]}><View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, unread && styles.bubbleUnread]}><Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text><View style={styles.bubbleMeta}><Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{niceTime(item.createdAt)}</Text>{mine && <View style={styles.messageTicks}>{item.readBy.length > 1 ? <><Feather name="check" size={12} color={c.accentForeground} /><Feather name="check" size={12} color={c.accentForeground} style={styles.secondTick} /></> : item.deliveredTo.length > 0 ? <><Feather name="check" size={12} color="#fff" /><Feather name="check" size={12} color="#fff" style={styles.secondTick} /></> : <Feather name="check" size={12} color="#fff" />}</View>}{unread && <Text style={styles.unreadLabel}>NEW</Text>}</View></View></Pressable>;
    }} />
    <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => void submit()} returnKeyType="send" placeholder="Write something soft…" placeholderTextColor={c.mutedForeground} style={styles.composerInput} /><Pressable disabled={!draft.trim()} onPress={() => void submit()} style={[styles.send, !draft.trim() && styles.sendDisabled]}><Feather name="arrow-up" size={19} color="#fff" /></Pressable></View>
  </KeyboardAvoidingView>;
}

function MemoryTile({ memory, compact = false, onEdit, onDelete }: { memory: CloudMemory; compact?: boolean; onEdit?: () => void; onDelete?: () => void }) {
  return <View style={[styles.memory, compact && styles.memoryCompact]}>{memory.photoUrl ? <Image source={{ uri: memory.photoUrl }} style={styles.memoryImage} /> : <LinearGradient colors={['#f1dce4', '#e8e0f0']} style={styles.memoryImage}><Feather name="heart" size={34} color="#b95a79" /></LinearGradient>}<View style={styles.memoryBody}><Text style={styles.memoryMeta}>{niceDate(memory.date)} · {memory.creatorName}</Text><Text style={styles.memoryTitle}>{memory.title}</Text><Text numberOfLines={compact ? 2 : 5} style={styles.memoryDescription}>{memory.description}</Text><View style={styles.tileActions}>{onEdit && <Pressable onPress={onEdit}><Text style={styles.actionLink}>Edit</Text></Pressable>}{onDelete && <Pressable onPress={onDelete}><Text style={styles.deleteLink}>Delete</Text></Pressable>}</View></View></View>;
}

function Memories({ openComposer, onEdit }: { openComposer: () => void; onEdit: (memory: CloudMemory) => void }) {
  const { currentUser, memories, deleteMemory } = useCloudApp();
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.pageHeading}><View><Text style={styles.eyebrow}>Shared timeline</Text><Text style={styles.pageTitle}>Memories</Text></View><IconButton icon="plus" label="Add memory" onPress={openComposer} color={c.primary} /></View><Text style={styles.pageDescription}>The little things you never want to lose.</Text>{memories.length ? memories.map((item) => <MemoryTile key={item.id} memory={item} onEdit={() => onEdit(item)} onDelete={currentUser?.role === 'OWNER' || currentUser?.id === item.creatorId ? () => Alert.alert('Delete memory?', 'This removes it for both of you.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteMemory(item.id) }]) : undefined} />) : <Empty icon="book-open" title="Nothing here yet" body="Add your first shared memory from the home screen." />}</ScrollView>;
}

function Gallery({ openComposer, onOpen }: { openComposer: () => void; onOpen: (photo: CloudPhoto) => void }) {
  const { photos } = useCloudApp();
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.pageHeading}><View><Text style={styles.eyebrow}>Shared album</Text><Text style={styles.pageTitle}>Gallery</Text></View><IconButton icon="plus" label="Upload a photo" onPress={openComposer} color={c.primary} /></View><Text style={styles.pageDescription}>A collection of the days that feel like ours.</Text>{photos.length ? <View style={styles.gallery}>{photos.map((photo) => <Pressable key={photo.id} onPress={() => onOpen(photo)} style={styles.photoTile}><Image source={{ uri: photo.url }} style={styles.photoImage} /><View style={styles.photoCaption}><Text numberOfLines={1} style={styles.photoCaptionText}>{photo.caption || 'A moment worth keeping'}</Text><Text style={styles.photoMeta}>{photo.uploadedBy} · {niceDate(photo.date)}</Text></View></Pressable>)}</View> : <Empty icon="camera" title="Your album begins here" body="Upload a photo and it will stay close to both of you." />}</ScrollView>;
}

function Timeline({ openComposer, onEdit }: { openComposer: () => void; onEdit: (entry: CloudTimelineEntry) => void }) {
  const { currentUser, timeline, deleteTimeline } = useCloudApp();
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.pageHeading}><View><Text style={styles.eyebrow}>Your story</Text><Text style={styles.pageTitle}>Timeline</Text></View><IconButton icon="plus" label="Add timeline entry" onPress={openComposer} color={c.primary} /></View><Text style={styles.pageDescription}>The chapters you are writing together.</Text>{timeline.length ? timeline.map((item, index) => <View key={item.id} style={styles.timelineRow}><View style={styles.timelineRail}><View style={styles.timelineDot} />{index < timeline.length - 1 && <View style={styles.timelineLine} />}</View><View style={styles.timelineCard}>{item.photoUrl && <Image source={{ uri: item.photoUrl }} style={styles.timelineImage} />}<Text style={styles.memoryMeta}>{niceDate(item.date)} · {item.creatorName}</Text><Text style={styles.memoryTitle}>{item.title}</Text><Text style={styles.memoryDescription}>{item.description}</Text><View style={styles.tileActions}><Pressable onPress={() => onEdit(item)}><Text style={styles.actionLink}>Edit</Text></Pressable>{(currentUser?.role === 'OWNER' || currentUser?.id === item.creatorId) && <Pressable onPress={() => void deleteTimeline(item.id)}><Text style={styles.deleteLink}>Delete</Text></Pressable>}</View></View></View>) : <Empty icon="clock" title="Your story starts here" body="Add the first chapter of your shared timeline." />}</ScrollView>;
}

function Letters({ openComposer }: { openComposer: () => void }) {
  const { currentUser, letters, markLetterOpened } = useCloudApp();
  const [opened, setOpened] = useState<string | null>(null);
  const animation = useRef(new Animated.Value(0)).current;
  const open = async (letter: CloudLetter) => {
    setOpened(letter.id);
    animation.setValue(0);
    Animated.spring(animation, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    await markLetterOpened(letter.id);
  };
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.pageHeading}><View><Text style={styles.eyebrow}>Words to keep</Text><Text style={styles.pageTitle}>Letters</Text></View><IconButton icon="plus" label="Write a letter" onPress={openComposer} color={c.primary} /></View><Text style={styles.pageDescription}>A slower way to say what matters.</Text>{letters.length ? letters.map((letter) => { const isOpen = opened === letter.id; return <Pressable key={letter.id} onPress={() => void open(letter)} style={styles.letterCard}><Animated.View style={[styles.envelope, isOpen && { transform: [{ scale: animation.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }, { rotate: animation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-2deg'] }) }] }]}><Feather name="mail" size={26} color={c.primary} /></Animated.View><View style={{ flex: 1 }}><Text style={styles.letterDate}>{niceDate(letter.date)} · {letter.authorName}</Text><Text style={styles.letterTitle}>{letter.title}</Text>{isOpen ? <Text style={styles.letterMessage}>{letter.message}</Text> : <Text style={styles.letterHint}>{letter.openedBy.includes(currentUser?.id ?? '') ? 'Read again' : 'Tap to open the envelope'}</Text>}</View><Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.mutedForeground} /></Pressable>; }) : <Empty icon="mail" title="No letters yet" body="Write something that deserves more than a text." />}</ScrollView>;
}

function Music() {
  const { songs, addSong } = useCloudApp();
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const sound = useRef<Audio.Sound | null>(null);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => () => { void sound.current?.unloadAsync(); }, []);
  const play = async (id: string, url: string) => {
    if (playing === id) { await sound.current?.pauseAsync(); setPlaying(null); return; }
    await sound.current?.unloadAsync();
    const created = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true }, (status) => { if (status.isLoaded) setProgress(status.positionMillis / Math.max(status.durationMillis || 1, 1)); });
    sound.current = created.sound; setPlaying(id);
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 5000, easing: (value) => value, useNativeDriver: true })).start();
  };
  const upload = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    await addSong({ title: asset.name.replace(/\.[^/.]+$/, ''), artist: 'Our private playlist', audioUri: asset.uri }, () => undefined);
  };
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.pageHeading}><View><Text style={styles.eyebrow}>Your soundtrack</Text><Text style={styles.pageTitle}>Music</Text></View><IconButton icon="plus" label="Upload music" onPress={() => void upload()} color={c.primary} /></View><Text style={styles.pageDescription}>Songs that sound like the two of you.</Text>{songs.length ? songs.map((song) => <View key={song.id} style={styles.songCard}><Animated.View style={[styles.cd, playing === song.id && { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>{song.coverUrl ? <Image source={{ uri: song.coverUrl }} style={styles.cdImage} /> : <Feather name="music" size={25} color="#fff" />}<View style={styles.cdHole} /></Animated.View><View style={{ flex: 1 }}><Text style={styles.songTitle}>{song.title}</Text><Text style={styles.songArtist}>{song.artist}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${playing === song.id ? progress * 100 : 0}%` }]} /></View></View><IconButton icon={playing === song.id ? 'pause' : 'play'} label={playing === song.id ? 'Pause song' : 'Play song'} onPress={() => void play(song.id, song.audioUrl)} color={c.primary} /></View>) : <Empty icon="music" title="Your playlist is quiet" body="Upload an audio file and give this world a soundtrack." />}</ScrollView>;
}

function Composer({ kind, onClose }: { kind: Exclude<ComposerKind, null>; onClose: () => void }) {
  const { addMemory, addPhoto, addTimeline, addLetter, addSong } = useCloudApp();
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [date, setDate] = useState(today()); const [caption, setCaption] = useState(''); const [artist, setArtist] = useState(''); const [uri, setUri] = useState(''); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0);
  const pickImage = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.86, allowsEditing: true }); if (!result.canceled) setUri(result.assets[0].uri); };
  const pickAudio = async () => { const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true }); if (!result.canceled) setUri(result.assets[0].uri); };
  const submit = async () => {
    if (!title.trim() && kind !== 'photo') return Alert.alert('Add a title', 'Give this part of your world a name first.');
    if (!uri && ['photo', 'song'].includes(kind)) return Alert.alert('Choose a file', kind === 'photo' ? 'Choose a photo to upload.' : 'Choose an audio file to upload.');
    setBusy(true); setProgress(0);
    try {
      if (kind === 'memory') await addMemory({ title, description, date, photoUri: uri || undefined }, setProgress);
      if (kind === 'photo') await addPhoto({ uri, caption, date }, setProgress);
      if (kind === 'timeline') await addTimeline({ title, description, date, photoUri: uri || undefined }, setProgress);
      if (kind === 'letter') await addLetter({ title, message: description, date, photoUri: uri || undefined }, setProgress);
      if (kind === 'song') await addSong({ title, artist, audioUri: uri }, setProgress);
      onClose();
    } catch (error) { Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.'); } finally { setBusy(false); }
  };
  const labels = { memory: ['Save a memory', 'A moment worth keeping'], photo: ['Add to gallery', 'A photo from your world'], timeline: ['Add a chapter', 'A date in your story'], letter: ['Write a letter', 'Something to open slowly'], song: ['Add to music', 'A song for the two of you'] };
  return <Sheet visible title={labels[kind][0]} eyebrow={labels[kind][1]} onClose={onClose}>{kind !== 'photo' && <Field label={kind === 'song' ? 'Song title' : 'Title'} value={title} onChangeText={setTitle} placeholder="Give it a name" />}{kind === 'song' && <Field label="Artist" value={artist} onChangeText={setArtist} placeholder="Who made it?" />}{kind !== 'song' && <Field label={kind === 'letter' ? 'Letter' : 'Description'} value={kind === 'photo' ? caption : description} onChangeText={kind === 'photo' ? setCaption : setDescription} placeholder={kind === 'letter' ? 'Write from the heart…' : 'Tell the story behind it…'} multiline />}{kind !== 'song' && <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />}{['memory', 'photo', 'timeline', 'letter'].includes(kind) && <Button title={uri ? 'Photo selected' : 'Attach a photo'} icon={uri ? 'check' : 'image'} onPress={() => void pickImage()} ghost />}{kind === 'song' && <Button title={uri ? 'Audio selected' : 'Choose audio'} icon={uri ? 'check' : 'music'} onPress={() => void pickAudio()} ghost />}{busy && <View style={styles.uploadProgress}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /><Text style={styles.progressText}>{Math.round(progress * 100)}% uploaded</Text></View>}<Button title={busy ? 'Saving securely…' : 'Save to our world'} icon="heart" onPress={() => void submit()} disabled={busy} /></Sheet>;
}

function EditSheet({ kind, item, onClose }: { kind: 'memory' | 'timeline'; item: CloudMemory | CloudTimelineEntry; onClose: () => void }) {
  const { updateMemory, updateTimeline } = useCloudApp();
  const [title, setTitle] = useState(item.title); const [description, setDescription] = useState(item.description); const [date, setDate] = useState(item.date); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { if (kind === 'memory') await updateMemory(item.id, { title, description, date }); else await updateTimeline(item.id, { title, description, date }); onClose(); } catch (error) { Alert.alert('Could not update', error instanceof Error ? error.message : 'Please try again.'); } finally { setBusy(false); } };
  return <Sheet visible title={kind === 'memory' ? 'Edit memory' : 'Edit chapter'} eyebrow="Make it feel right" onClose={onClose}><Field label="Title" value={title} onChangeText={setTitle} /><Field label="Description" value={description} onChangeText={setDescription} multiline /><Field label="Date" value={date} onChangeText={setDate} /><Button title={busy ? 'Saving…' : 'Save changes'} icon="check" onPress={() => void save()} disabled={busy} /></Sheet>;
}

function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, updateSettings, updateProfile, uploadAsset, currentUser } = useCloudApp();
  const [form, setForm] = useState({ ownerName: '', partnerName: '', greeting: '', themePrimary: c.primary, homeTitle: '', chatTitle: '', memoriesTitle: '', lettersTitle: '', musicTitle: '', importantDates: '', secretMessage: '', finalMessage: '' });
  const [profilePhotoUri, setProfilePhotoUri] = useState('');
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => { if (settings) setForm({ ownerName: settings.ownerName, partnerName: settings.partnerName, greeting: settings.greeting, themePrimary: settings.themePrimary || c.primary, homeTitle: settings.homeTitle, chatTitle: settings.chatTitle, memoriesTitle: settings.memoriesTitle, lettersTitle: settings.lettersTitle, musicTitle: settings.musicTitle, importantDates: settings.importantDates.join('\n'), secretMessage: settings.secretMessage, finalMessage: settings.finalMessage }); }, [settings]);
  const pickProfilePhoto = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.86, allowsEditing: true, aspect: [1, 1] }); if (!result.canceled) setProfilePhotoUri(result.assets[0].uri); };
  const save = async () => {
    const settingsInput = { ...form, importantDates: form.importantDates.split('\n').map((value) => value.trim()).filter(Boolean) };
    await updateSettings(settingsInput);
    if (currentUser?.role === 'OWNER') {
      const profileInput: { name?: string; photoUrl?: string } = {};
      if (form.ownerName.trim()) profileInput.name = form.ownerName.trim();
      if (profilePhotoUri) profileInput.photoUrl = await uploadAsset(profilePhotoUri, `profiles/${currentUser.id}/avatar-${Date.now()}`);
      if (Object.keys(profileInput).length) await updateProfile(profileInput);
    }
    Alert.alert('Saved', 'Your private world has been updated for both of you.'); onClose();
  };
  return <Sheet visible={visible} title="Shape your world" eyebrow="Owner customization" onClose={onClose}><Text style={styles.settingsNote}>These changes sync to both devices. Keep the shared space personal and easy to recognize.</Text><Field label="Your name" value={form.ownerName} onChangeText={(value) => set('ownerName', value)} /><Field label="Partner name" value={form.partnerName} onChangeText={(value) => set('partnerName', value)} /><Button title={profilePhotoUri ? 'Profile photo selected' : 'Choose your profile photo'} icon={profilePhotoUri ? 'check' : 'user'} onPress={() => void pickProfilePhoto()} ghost /><Field label="Greeting" value={form.greeting} onChangeText={(value) => set('greeting', value)} multiline /><Field label="Theme color (hex)" value={form.themePrimary} onChangeText={(value) => set('themePrimary', value)} placeholder="#c75b7c" /><Text style={styles.formSection}>Section titles</Text><Field label="Home" value={form.homeTitle} onChangeText={(value) => set('homeTitle', value)} /><Field label="Chat" value={form.chatTitle} onChangeText={(value) => set('chatTitle', value)} /><Field label="Memories" value={form.memoriesTitle} onChangeText={(value) => set('memoriesTitle', value)} /><Field label="Letters" value={form.lettersTitle} onChangeText={(value) => set('lettersTitle', value)} /><Field label="Music" value={form.musicTitle} onChangeText={(value) => set('musicTitle', value)} /><Field label="Important dates" value={form.importantDates} onChangeText={(value) => set('importantDates', value)} placeholder="One date per line" multiline /><Field label="Secret reveal message" value={form.secretMessage} onChangeText={(value) => set('secretMessage', value)} multiline /><Field label="Final message" value={form.finalMessage} onChangeText={(value) => set('finalMessage', value)} multiline /><Button title="Save shared customization" icon="save" onPress={() => void save()} /></Sheet>;
}

function FullscreenPhoto({ photo, onClose }: { photo: CloudPhoto | null; onClose: () => void }) {
  return <Modal visible={!!photo} transparent animationType="fade" onRequestClose={onClose}><View style={styles.viewer}><IconButton icon="x" label="Close photo" onPress={onClose} color="#fff" />{photo && <><Image source={{ uri: photo.url }} style={styles.fullImage} resizeMode="contain" /><Text style={styles.viewerCaption}>{photo.caption || 'A moment worth keeping'} · {niceDate(photo.date)}</Text></>}</View></Modal>;
}

export default function CloudPrivateWorldApp() {
  const { currentUser, isLoading, logout, messages, settings, notification, dismissNotification, notificationPermission, requestNotificationPermission } = useCloudApp();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>('home');
  const [composer, setComposer] = useState<ComposerKind>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [photo, setPhoto] = useState<CloudPhoto | null>(null);
  const [edit, setEdit] = useState<{ kind: 'memory' | 'timeline'; item: CloudMemory | CloudTimelineEntry } | null>(null);
  useEffect(() => subscribeToNotificationResponses((data) => {
    if (data.screen === 'chat' || typeof data.messageId === 'string') setSection('chat');
  }), []);
  if (isLoading) return <View style={styles.loading}><Mark size={58} /><Text style={styles.loadingTitle}>Opening your private world…</Text><Text style={styles.loadingSub}>Checking the two-person access list.</Text></View>;
  if (!currentUser) return <Login />;
  const unread = messages.filter((item) => item.senderId !== currentUser.id && !item.readBy.includes(currentUser.id)).length;
  const openComposer = (kind: Exclude<ComposerKind, null>) => setComposer(kind);
  const screen = section === 'home' ? <Home go={setSection} openComposer={openComposer} /> : section === 'chat' ? <Chat /> : section === 'memories' ? <Memories openComposer={() => openComposer('memory')} onEdit={(item) => setEdit({ kind: 'memory', item })} /> : section === 'gallery' ? <Gallery openComposer={() => openComposer('photo')} onOpen={setPhoto} /> : section === 'timeline' ? <Timeline openComposer={() => openComposer('timeline')} onEdit={(item) => setEdit({ kind: 'timeline', item })} /> : section === 'letters' ? <Letters openComposer={() => openComposer('letter')} /> : <Music />;
  return <View style={[styles.root, { paddingTop: insets.top }]}><Header onSettings={() => setSettingsOpen(true)} onLogout={() => void logout()} />{notification ? <View style={styles.notification}><Feather name="message-circle" size={16} color={c.primary} /><Text numberOfLines={2} style={styles.notificationText}>{notification}</Text>{notificationPermission === 'default' && <Pressable onPress={() => void requestNotificationPermission()} style={styles.notificationAction}><Text style={styles.notificationActionText}>Enable</Text></Pressable>}<Pressable accessibilityLabel="Dismiss notification" onPress={dismissNotification} hitSlop={8}><Feather name="x" size={15} color={c.mutedForeground} /></Pressable></View> : null}<View style={styles.screen}>{screen}</View><Navigation section={section} onChange={setSection} unread={unread} />{composer && <Composer kind={composer} onClose={() => setComposer(null)} />}{edit && <EditSheet kind={edit.kind} item={edit.item} onClose={() => setEdit(null)} />}<SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} /><FullscreenPhoto photo={photo} onClose={() => setPhoto(null)} />{settings?.finalMessage ? <Text style={styles.finalMessage}>{settings.finalMessage}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, screen: { flex: 1 }, loading: { flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', padding: 28 }, loadingTitle: { marginTop: 20, color: c.foreground, fontSize: 20, fontWeight: '700' }, loadingSub: { marginTop: 8, color: c.mutedForeground, textAlign: 'center' },
  login: { flex: 1, justifyContent: 'space-between', padding: 24 }, loginGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#eadcf1', right: -100, top: 100, opacity: 0.7 }, loginContent: { marginTop: 84, alignItems: 'flex-start' }, eyebrow: { color: c.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' }, loginTitle: { color: c.foreground, fontSize: 35, lineHeight: 40, fontWeight: '800', marginTop: 10 }, loginSub: { color: c.mutedForeground, fontSize: 15, lineHeight: 22, marginTop: 14, maxWidth: 360 }, loginCard: { backgroundColor: '#fff', borderRadius: 26, padding: 20, width: '100%', marginTop: 26, shadowColor: '#7b5360', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 4 }, loginFooter: { color: c.mutedForeground, textAlign: 'center', fontSize: 12, marginBottom: 16 }, field: { marginBottom: 14 }, fieldLabel: { color: c.foreground, fontSize: 12, fontWeight: '700', marginBottom: 7 }, input: { backgroundColor: '#fffaf9', borderColor: c.input, borderWidth: 1, borderRadius: 14, color: c.foreground, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 }, inputMultiline: { minHeight: 92, textAlignVertical: 'top' }, button: { alignItems: 'center', backgroundColor: c.primary, borderRadius: 15, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 48, paddingHorizontal: 18, marginTop: 5 }, buttonGhost: { backgroundColor: c.secondary }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' }, buttonGhostText: { color: c.primary }, buttonDisabled: { opacity: 0.55 }, secureNote: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 15 }, secureText: { color: c.mutedForeground, flex: 1, fontSize: 11, lineHeight: 16 }, error: { color: c.destructive, fontSize: 12, marginBottom: 11 }, pressed: { opacity: 0.72 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 13 }, identity: { alignItems: 'center', flexDirection: 'row', gap: 10 }, brand: { color: c.foreground, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 }, brandCaption: { color: c.mutedForeground, fontSize: 10, marginTop: 1 }, headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 }, iconButton: { alignItems: 'center', height: 38, justifyContent: 'center', width: 38 }, avatar: { alignItems: 'center', backgroundColor: c.secondary, borderColor: c.border, borderRadius: 19, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 }, avatarText: { color: c.primary, fontSize: 14, fontWeight: '800' }, notification: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#fff', borderColor: c.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 8, marginBottom: 8, maxWidth: '92%', paddingHorizontal: 13, paddingVertical: 9, shadowColor: '#7b5360', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, notificationText: { color: c.foreground, flex: 1, fontSize: 12, fontWeight: '700' }, notificationAction: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 }, notificationActionText: { color: c.accentForeground, fontSize: 10, fontWeight: '800' },
  navScroll: { backgroundColor: '#fff', borderTopColor: c.border, borderTopWidth: 1, flexGrow: 0, flexShrink: 0, height: 62, maxHeight: 62 }, nav: { alignItems: 'center', flexGrow: 0, flexShrink: 0, gap: 4, height: 61, minHeight: 0, paddingHorizontal: 8 }, navItem: { alignItems: 'center', borderRadius: 12, flexDirection: 'column', gap: 1, justifyContent: 'center', minWidth: 52, paddingHorizontal: 7, paddingVertical: 3 }, navItemActive: { backgroundColor: c.secondary }, navIcon: { alignItems: 'center', height: 17, justifyContent: 'center', position: 'relative', width: 20 }, navText: { color: c.mutedForeground, fontSize: 9, fontWeight: '700' }, navTextActive: { color: c.primary }, badge: { alignItems: 'center', backgroundColor: c.primary, borderColor: c.background, borderRadius: 8, borderWidth: 2, height: 16, justifyContent: 'center', minWidth: 16, position: 'absolute', right: -9, top: -8 }, badgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 46 }, greetingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }, date: { color: c.mutedForeground, fontSize: 12 }, greeting: { color: c.foreground, fontSize: 21, fontWeight: '800', marginTop: 4 }, syncPill: { alignItems: 'center', backgroundColor: '#eef7f0', borderRadius: 14, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 7 }, syncDot: { backgroundColor: '#5ca56e', borderRadius: 4, height: 7, width: 7 }, syncText: { color: '#4b865b', fontSize: 10, fontWeight: '800' }, hero: { borderRadius: 25, minHeight: 190, overflow: 'hidden', padding: 22 }, heroOrb: { backgroundColor: '#ffffff20', borderRadius: 100, height: 180, position: 'absolute', right: -34, top: -45, width: 180 }, heroCopy: { maxWidth: '85%' }, heroIcon: { alignItems: 'center', backgroundColor: '#ffffff25', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 }, heroKicker: { color: '#f9dce5', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 14, textTransform: 'uppercase' }, heroTitle: { color: '#fff', fontSize: 23, fontWeight: '800', lineHeight: 28, marginTop: 5 }, heroCaption: { color: '#f9dce5', fontSize: 12, lineHeight: 18, marginTop: 9 }, sectionTitle: { color: c.foreground, fontSize: 16, fontWeight: '800' }, quickGrid: { flexDirection: 'row', gap: 9, marginBottom: 23, marginTop: 12 }, quick: { alignItems: 'center', backgroundColor: '#fff', borderColor: c.border, borderRadius: 18, borderWidth: 1, flex: 1, minHeight: 88, justifyContent: 'center' }, quickIcon: { alignItems: 'center', borderRadius: 14, height: 39, justifyContent: 'center', width: 39 }, quickLabel: { color: c.foreground, fontSize: 11, fontWeight: '700', marginTop: 7 }, sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 11, marginTop: 9 }, link: { color: c.primary, fontSize: 12, fontWeight: '800' }, muted: { color: c.mutedForeground, fontSize: 11 }, stats: { flexDirection: 'row', gap: 8, marginBottom: 14 }, stat: { alignItems: 'flex-start', backgroundColor: '#fff', borderColor: c.border, borderRadius: 17, borderWidth: 1, flex: 1, minHeight: 88, padding: 12 }, statValue: { color: c.foreground, fontSize: 20, fontWeight: '800', marginTop: 7 }, statLabel: { color: c.mutedForeground, fontSize: 10, marginTop: 2 }, secretCard: { alignItems: 'center', backgroundColor: '#f1ebf7', borderRadius: 19, flexDirection: 'row', gap: 12, marginTop: 12, padding: 14 }, secretIcon: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 15, height: 38, justifyContent: 'center', width: 38 }, secretKicker: { color: c.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' }, secretText: { color: c.foreground, fontSize: 13, lineHeight: 18, marginTop: 3 }, lastMessage: { alignItems: 'center', backgroundColor: '#fff', borderColor: c.border, borderRadius: 19, borderWidth: 1, flexDirection: 'row', gap: 11, marginTop: 12, padding: 14 }, messageIcon: { alignItems: 'center', backgroundColor: c.secondary, borderRadius: 17, height: 34, justifyContent: 'center', width: 34 }, lastLabel: { color: c.mutedForeground, fontSize: 10 }, lastText: { color: c.foreground, fontSize: 13, fontWeight: '700', marginTop: 3 },
  pageHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, pageTitle: { color: c.foreground, fontSize: 25, fontWeight: '800', marginTop: 3 }, pageDescription: { color: c.mutedForeground, fontSize: 13, lineHeight: 19, marginBottom: 18, marginTop: 6 }, empty: { alignItems: 'center', backgroundColor: '#fff', borderColor: c.border, borderRadius: 23, borderWidth: 1, marginTop: 12, padding: 28 }, emptyIcon: { alignItems: 'center', backgroundColor: c.secondary, borderRadius: 22, height: 46, justifyContent: 'center', width: 46 }, emptyTitle: { color: c.foreground, fontSize: 16, fontWeight: '800', marginTop: 13 }, emptyBody: { color: c.mutedForeground, fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: 'center' },
  memory: { backgroundColor: '#fff', borderColor: c.border, borderRadius: 22, borderWidth: 1, marginBottom: 13, overflow: 'hidden' }, memoryCompact: { marginBottom: 10 }, memoryImage: { alignItems: 'center', height: 155, justifyContent: 'center', width: '100%' }, memoryBody: { padding: 15 }, memoryMeta: { color: c.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' }, memoryTitle: { color: c.foreground, fontSize: 18, fontWeight: '800', marginTop: 5 }, memoryDescription: { color: c.mutedForeground, fontSize: 13, lineHeight: 19, marginTop: 5 }, tileActions: { alignItems: 'center', flexDirection: 'row', gap: 20, marginTop: 12 }, actionLink: { color: c.primary, fontSize: 12, fontWeight: '800' }, deleteLink: { color: c.destructive, fontSize: 12, fontWeight: '800' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, photoTile: { backgroundColor: '#fff', borderColor: c.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden', width: '48%' }, photoImage: { backgroundColor: c.secondary, height: 150, width: '100%' }, photoCaption: { padding: 9 }, photoCaptionText: { color: c.foreground, fontSize: 12, fontWeight: '800' }, photoMeta: { color: c.mutedForeground, fontSize: 9, marginTop: 3 },
  timelineRow: { flexDirection: 'row', gap: 12 }, timelineRail: { alignItems: 'center', width: 16 }, timelineDot: { backgroundColor: c.primary, borderColor: '#fff', borderRadius: 8, borderWidth: 3, height: 16, width: 16, zIndex: 1 }, timelineLine: { backgroundColor: c.border, flex: 1, marginTop: -1, width: 2 }, timelineCard: { backgroundColor: '#fff', borderColor: c.border, borderRadius: 18, borderWidth: 1, flex: 1, marginBottom: 13, padding: 15 }, timelineImage: { borderRadius: 12, height: 130, marginBottom: 12, width: '100%' },
  letterCard: { alignItems: 'flex-start', backgroundColor: '#fff', borderColor: c.border, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 12, marginBottom: 12, padding: 15 }, envelope: { alignItems: 'center', backgroundColor: c.secondary, borderRadius: 18, height: 52, justifyContent: 'center', width: 52 }, letterDate: { color: c.primary, fontSize: 10, fontWeight: '800' }, letterTitle: { color: c.foreground, fontSize: 16, fontWeight: '800', marginTop: 4 }, letterHint: { color: c.mutedForeground, fontSize: 12, marginTop: 5 }, letterMessage: { color: c.foreground, fontSize: 14, lineHeight: 21, marginTop: 8 },
  songCard: { alignItems: 'center', backgroundColor: '#fff', borderColor: c.border, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 13, marginBottom: 12, padding: 13 }, cd: { alignItems: 'center', backgroundColor: '#b95a79', borderColor: '#e9bdca', borderRadius: 34, borderWidth: 4, height: 68, justifyContent: 'center', overflow: 'hidden', width: 68 }, cdImage: { height: '100%', width: '100%' }, cdHole: { backgroundColor: '#fff4f5', borderColor: '#b95a79', borderRadius: 6, borderWidth: 2, height: 12, position: 'absolute', width: 12 }, songTitle: { color: c.foreground, fontSize: 15, fontWeight: '800' }, songArtist: { color: c.mutedForeground, fontSize: 12, marginTop: 3 }, progressTrack: { backgroundColor: c.muted, borderRadius: 3, height: 4, marginTop: 10, overflow: 'hidden', width: '100%' }, progressFill: { backgroundColor: c.primary, borderRadius: 3, height: '100%' },
  chat: { flex: 1, paddingHorizontal: 20 }, chatIntro: { alignItems: 'center', flexDirection: 'row', gap: 11, paddingBottom: 12 }, chatAvatar: { alignItems: 'center', backgroundColor: c.secondary, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, messageList: { gap: 10, paddingBottom: 16, paddingTop: 10 }, messageRow: { alignItems: 'flex-start', flexDirection: 'row' }, messageRowMine: { justifyContent: 'flex-end' }, bubble: { borderRadius: 19, maxWidth: '83%', paddingHorizontal: 14, paddingVertical: 10 }, bubbleTheirs: { backgroundColor: '#fff', borderColor: c.border, borderWidth: 1, borderBottomLeftRadius: 5 }, bubbleMine: { backgroundColor: c.primary, borderBottomRightRadius: 5 }, bubbleUnread: { borderColor: c.primary, borderWidth: 2 }, bubbleText: { color: c.foreground, fontSize: 14, lineHeight: 20 }, bubbleTextMine: { color: '#fff' }, bubbleMeta: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'flex-end', marginTop: 4 }, bubbleTime: { color: c.mutedForeground, fontSize: 9 }, bubbleTimeMine: { color: '#f7d9e1' }, messageTicks: { alignItems: 'center', flexDirection: 'row', height: 14 }, secondTick: { marginLeft: -7 }, unreadLabel: { color: c.primary, fontSize: 8, fontWeight: '900' }, composer: { alignItems: 'center', backgroundColor: '#fff', borderColor: c.border, borderRadius: 20, borderWidth: 1, flexDirection: 'row', marginBottom: 14, padding: 6 }, composerInput: { color: c.foreground, flex: 1, fontSize: 14, minHeight: 38, paddingHorizontal: 10 }, send: { alignItems: 'center', backgroundColor: c.primary, borderRadius: 17, height: 34, justifyContent: 'center', width: 34 }, sendDisabled: { opacity: 0.4 },
  modalBackdrop: { backgroundColor: '#271b2488', flex: 1, justifyContent: 'flex-end' }, sheet: { backgroundColor: c.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '92%', paddingHorizontal: 20, paddingTop: 10 }, sheetHandle: { alignSelf: 'center', backgroundColor: c.border, borderRadius: 3, height: 5, width: 46 }, sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 }, sheetTitle: { color: c.foreground, fontSize: 22, fontWeight: '800', marginTop: 3 }, sheetScroll: { paddingBottom: 30 }, uploadProgress: { backgroundColor: c.muted, borderRadius: 5, height: 7, marginBottom: 12, overflow: 'hidden' }, progressText: { color: c.mutedForeground, fontSize: 10, marginTop: 10 }, settingsNote: { color: c.mutedForeground, fontSize: 13, lineHeight: 19, marginBottom: 18 }, formSection: { color: c.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginTop: 3, textTransform: 'uppercase' },
  viewer: { alignItems: 'center', backgroundColor: '#181016', flex: 1, justifyContent: 'center', padding: 20 }, fullImage: { height: '76%', width: '100%' }, viewerCaption: { color: '#fff', fontSize: 13, marginTop: 14, textAlign: 'center' }, finalMessage: { bottom: 5, color: c.mutedForeground, fontSize: 9, position: 'absolute', right: 16 },
});