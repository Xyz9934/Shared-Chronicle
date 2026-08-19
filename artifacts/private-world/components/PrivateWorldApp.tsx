import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp, type AppSection, type Memory } from '@/context/AppContext';
import { syncMode } from '@/services/firebase';
import colors from '@/constants/colors';

const theme = colors.light;
const assetImages = {
  coffee: require('@/assets/images/memory-coffee.jpg'),
  letter: require('@/assets/images/memory-letter.jpg'),
  sunset: require('@/assets/images/memory-sunset.jpg'),
};

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatToday = () =>
  new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });

function IconButton({
  icon,
  onPress,
  label,
  tintColor = theme.foreground,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
  tintColor?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Feather name={icon} size={19} color={tintColor} />
    </Pressable>
  );
}

function AppMark({ size = 46 }: { size?: number }) {
  return (
    <LinearGradient
      colors={['#d97591', '#b94e72']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 3, alignItems: 'center', justifyContent: 'center' }}
    >
      <Feather name="heart" size={size * 0.43} color="#fff9f7" />
    </LinearGradient>
  );
}

function PrimaryButton({
  title,
  icon,
  onPress,
  disabled = false,
}: {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Feather name={icon} size={17} color={theme.primaryForeground} />
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function LoginScreen() {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('owner123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    Keyboard.dismiss();
    setError('');
    setBusy(true);
    const valid = await login(username, password);
    setBusy(false);
    if (!valid) setError('That login does not match one of the two private accounts.');
  };

  return (
    <LinearGradient colors={['#fff9f7', '#f9e9ed', '#eee6f6']} style={styles.loginRoot}>
      <View style={styles.loginGlow} />
      <View style={styles.loginContent}>
        <AppMark size={64} />
        <Text style={styles.eyebrow}>A space for two</Text>
        <Text style={styles.loginTitle}>Welcome back{'\n'}to your little world.</Text>
        <Text style={styles.loginSubtitle}>A quiet place for the words, photos, and moments that belong to you both.</Text>

        <View style={styles.loginCard}>
          <Text style={styles.fieldLabel}>Username</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
            placeholder="tommy or jerry"
            placeholderTextColor={theme.mutedForeground}
            style={styles.input}
            value={username}
          />
          <Text style={[styles.fieldLabel, styles.passwordLabel]}>Password</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="Your private password"
            placeholderTextColor={theme.mutedForeground}
            secureTextEntry
            style={styles.input}
            value={password}
          />
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton title={busy ? 'Opening your space...' : 'Enter privately'} icon="arrow-right" onPress={submit} disabled={busy} />
          <View style={styles.demoHint}>
            <Feather name="shield" size={15} color={theme.primary} />
            <Text style={styles.demoHintText}>Preview accounts are ready while Firebase is being connected.</Text>
          </View>
        </View>
      </View>
      <Text style={styles.loginFooter}>Private by design · {syncMode}</Text>
    </LinearGradient>
  );
}

function SectionNav({ section, onChange }: { section: AppSection; onChange: (value: AppSection) => void }) {
  const items: Array<{ key: AppSection; label: string; icon: keyof typeof Feather.glyphMap }> = [
    { key: 'home', label: 'Home', icon: 'home' },
    { key: 'chat', label: 'Chat', icon: 'message-circle' },
    { key: 'memories', label: 'Memories', icon: 'book-open' },
    { key: 'gallery', label: 'Gallery', icon: 'image' },
  ];
  return (
    <View style={styles.navRow}>
      {items.map((item) => {
        const active = item.key === section;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={item.key}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [styles.navItem, active && styles.navItemActive, pressed && styles.pressed]}
          >
            <Feather name={item.icon} size={16} color={active ? theme.primary : theme.mutedForeground} />
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Header({ onLogout, onOwner }: { onLogout: () => void; onOwner: () => void }) {
  const { currentUser } = useApp();
  return (
    <View style={styles.header}>
      <View style={styles.headerIdentity}>
        <AppMark />
        <View>
          <Text style={styles.brandName}>private world</Text>
          <Text style={styles.brandCaption}>just the two of you</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        {currentUser?.role === 'OWNER' && <IconButton icon="sliders" label="Open owner tools" onPress={onOwner} tintColor={theme.primary} />}
        <Pressable accessibilityLabel="Sign out" onPress={onLogout} style={styles.avatar}>
          <Text style={styles.avatarText}>{currentUser?.initials ?? 'P'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HomeSection({
  onNavigate,
  onAddMemory,
  onAddPhoto,
  onSendMessage,
}: {
  onNavigate: (section: AppSection) => void;
  onAddMemory: () => void;
  onAddPhoto: () => void;
  onSendMessage: () => void;
}) {
  const { currentUser, memories, messages, photos, isFirebaseConfigured } = useApp();
  const latestMemory = memories[0];
  const latestMessage = messages[messages.length - 1];
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.greetingRow}>
        <View>
          <Text style={styles.dateText}>{formatToday()}</Text>
          <Text style={styles.greeting}>Good morning, {currentUser?.name}</Text>
        </View>
        <View style={styles.syncPill}>
          <View style={[styles.syncDot, { backgroundColor: isFirebaseConfigured ? '#62a77a' : '#d29454' }]} />
          <Text style={styles.syncText}>{isFirebaseConfigured ? 'Synced' : 'Preview'}</Text>
        </View>
      </View>

      <LinearGradient colors={['#d67693', '#bd5c7d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
        <View style={styles.heroOrb} />
        <View style={styles.heroCopy}>
          <View style={styles.heroIcon}><Feather name="heart" size={18} color="#fff9f7" /></View>
          <Text style={styles.heroKicker}>A note for today</Text>
          <Text style={styles.heroTitle}>The ordinary moments are the ones we keep.</Text>
          <Text style={styles.heroCaption}>Your private world is growing softly, one little memory at a time.</Text>
        </View>
        <Feather name="more-horizontal" size={22} color="#f9dfe6" style={styles.heroMore} />
      </LinearGradient>

      <Text style={styles.sectionTitle}>Make it yours</Text>
      <View style={styles.quickGrid}>
        <QuickAction icon="book-open" label="Add memory" tint="#b54d71" onPress={onAddMemory} />
        <QuickAction icon="camera" label="Upload photo" tint="#8061a0" onPress={onAddPhoto} />
        <QuickAction icon="message-circle" label="Send message" tint="#5d8a86" onPress={onSendMessage} />
        <QuickAction icon="music" label="Music shelf" tint="#c3874f" onPress={() => Alert.alert('Music shelf', 'Audio uploads will be enabled with Firebase Storage in the next cloud milestone.')} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Latest memory</Text>
        <Pressable onPress={() => onNavigate('memories')}><Text style={styles.linkText}>See all</Text></Pressable>
      </View>
      {latestMemory ? <MemoryCard memory={latestMemory} compact /> : <EmptyState icon="book-open" title="Your first memory is waiting" body="Save something small from today." />}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Inside your world</Text>
        <Text style={styles.mutedText}>at a glance</Text>
      </View>
      <View style={styles.glanceRow}>
        <GlanceCard icon="message-circle" value={String(messages.length)} label="messages" tint="#5d8a86" onPress={() => onNavigate('chat')} />
        <GlanceCard icon="image" value={String(photos.length)} label="photos" tint="#8061a0" onPress={() => onNavigate('gallery')} />
        <GlanceCard icon="book-open" value={String(memories.length)} label="memories" tint="#b54d71" onPress={() => onNavigate('memories')} />
      </View>
      {latestMessage && (
        <Pressable onPress={() => onNavigate('chat')} style={({ pressed }) => [styles.lastMessage, pressed && styles.pressed]}>
          <View style={styles.messageIcon}><Feather name="message-circle" size={18} color={theme.primary} /></View>
          <View style={styles.lastMessageCopy}>
            <Text style={styles.lastMessageLabel}>Last note from {latestMessage.senderName}</Text>
            <Text numberOfLines={1} style={styles.lastMessageText}>{latestMessage.text}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.mutedForeground} />
        </Pressable>
      )}
    </ScrollView>
  );
}

function QuickAction({ icon, label, tint, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; tint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <View style={[styles.quickIcon, { backgroundColor: `${tint}18` }]}><Feather name={icon} size={21} color={tint} /></View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function GlanceCard({ icon, value, label, tint, onPress }: { icon: keyof typeof Feather.glyphMap; value: string; label: string; tint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.glanceCard, pressed && styles.pressed]}>
      <Feather name={icon} size={18} color={tint} />
      <Text style={styles.glanceValue}>{value}</Text>
      <Text style={styles.glanceLabel}>{label}</Text>
    </Pressable>
  );
}

function ChatSection() {
  const { currentUser, messages, sendMessage } = useApp();
  const [draft, setDraft] = useState('');
  const submit = async () => {
    if (!draft.trim()) return;
    const text = draft;
    setDraft('');
    await sendMessage(text);
  };
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.chatRoot} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
      <View style={styles.chatIntro}>
        <View style={styles.chatTitleRow}>
          <View style={styles.chatAvatar}><Feather name="heart" size={18} color={theme.primary} /></View>
          <View><Text style={styles.chatTitle}>Just between us</Text><Text style={styles.chatSubtitle}>Your private conversation</Text></View>
        </View>
        <View style={styles.onlinePill}><View style={styles.onlineDot} /><Text style={styles.onlineText}>Two people here</Text></View>
      </View>
      <FlatList
        contentContainerStyle={styles.messageList}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const mine = item.senderId === currentUser?.id;
          return (
            <View style={[styles.messageRow, mine && styles.messageRowMine]}>
              {!mine && <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{item.senderName.slice(0, 1)}</Text></View>}
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
                <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{formatTime(item.createdAt)}</Text>
              </View>
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
      <View style={styles.composerShell}>
        <TextInput
          accessibilityLabel="Message"
          onChangeText={setDraft}
          onSubmitEditing={() => void submit()}
          placeholder="Write something soft..."
          placeholderTextColor={theme.mutedForeground}
          returnKeyType="send"
          style={styles.composerInput}
          value={draft}
        />
        <Pressable accessibilityLabel="Send message" disabled={!draft.trim()} onPress={() => void submit()} style={({ pressed }) => [styles.sendButton, !draft.trim() && styles.sendButtonDisabled, pressed && styles.pressed]}>
          <Feather name="arrow-up" size={19} color={theme.primaryForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MemoryCard({ memory, compact = false, onDelete }: { memory: Memory; compact?: boolean; onDelete?: () => void }) {
  const image = memory.imageUri ? { uri: memory.imageUri } : memory.imageKey ? assetImages[memory.imageKey] : assetImages.letter;
  return (
    <View style={[styles.memoryCard, compact && styles.memoryCardCompact]}>
      <Image source={image} style={styles.memoryImage} />
      <View style={styles.memoryOverlay} />
      <View style={styles.memoryInfo}>
        <Text style={styles.memoryDate}>{memory.date} · {memory.creatorName}</Text>
        <Text style={styles.memoryTitle}>{memory.title}</Text>
        <Text numberOfLines={compact ? 2 : 4} style={styles.memoryDescription}>{memory.description}</Text>
      </View>
      {!!onDelete && <IconButton icon="trash-2" label="Delete memory" onPress={onDelete} tintColor="#fff9f7" />}
    </View>
  );
}

function MemoriesSection() {
  const { currentUser, memories, deleteMemory } = useApp();
  const [sortNewest, setSortNewest] = useState(true);
  const sorted = useMemo(
    () => [...memories].sort((a, b) => (sortNewest ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt))),
    [memories, sortNewest],
  );
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <View><Text style={styles.pageEyebrow}>Shared timeline</Text><Text style={styles.pageTitle}>Memories</Text></View>
        <Pressable onPress={() => setSortNewest((value) => !value)} style={styles.sortButton}>
          <Feather name="sliders" size={15} color={theme.primary} /><Text style={styles.sortText}>{sortNewest ? 'Newest' : 'Oldest'}</Text>
        </Pressable>
      </View>
      <Text style={styles.pageDescription}>The little things you never want to lose.</Text>
      <View style={styles.timelineLine} />
      {sorted.map((memory, index) => (
        <View key={memory.id} style={styles.timelineItem}>
          <View style={styles.timelineDot}><View style={styles.timelineDotInner} /></View>
          <MemoryCard memory={memory} onDelete={currentUser?.role === 'OWNER' ? () => deleteMemory(memory.id) : undefined} />
          {index < sorted.length - 1 && <View style={styles.timelineConnector} />}
        </View>
      ))}
      {sorted.length === 0 && <EmptyState icon="book-open" title="Nothing here yet" body="Add your first shared memory from the home screen." />}
    </ScrollView>
  );
}

function GallerySection({ onAddPhoto }: { onAddPhoto: () => void }) {
  const { photos } = useApp();
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <View><Text style={styles.pageEyebrow}>Shared album</Text><Text style={styles.pageTitle}>Gallery</Text></View>
        <IconButton icon="plus" label="Upload a photo" onPress={onAddPhoto} tintColor={theme.primary} />
      </View>
      <Text style={styles.pageDescription}>A collection of the days that feel like ours.</Text>
      {photos.length === 0 ? (
        <View>
          <View style={styles.galleryPreviewRow}>
            <Image source={assetImages.coffee} style={styles.galleryPreview} />
            <Image source={assetImages.letter} style={styles.galleryPreview} />
            <Image source={assetImages.sunset} style={styles.galleryPreview} />
          </View>
          <EmptyState icon="camera" title="Your album begins here" body="Upload a photo and it will stay close to both of you." />
        </View>
      ) : (
        <View style={styles.galleryGrid}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.galleryTile}>
              <Image source={{ uri: photo.uri }} style={styles.galleryImage} />
              <View style={styles.galleryCaption}><Text numberOfLines={1} style={styles.galleryCaptionText}>{photo.caption || 'A moment worth keeping'}</Text><Text style={styles.galleryMeta}>{photo.uploadedBy}</Text></View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function EmptyState({ icon, title, body }: { icon: keyof typeof Feather.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Feather name={icon} size={22} color={theme.primary} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function OwnerModal({ visible, onClose, onAddMemory, onAddPhoto }: { visible: boolean; onClose: () => void; onAddMemory: () => void; onAddPhoto: () => void }) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}><View style={styles.ownerSheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>Owner area</Text><Text style={styles.sheetTitle}>Keep your world cared for.</Text></View><IconButton icon="x" label="Close" onPress={onClose} /></View>
        <Text style={styles.sheetDescription}>Manage the content that makes this place yours. Changes are saved to this device now and ready for Firebase sync.</Text>
        <PrimaryButton title="Create a memory" icon="book-open" onPress={() => { onClose(); onAddMemory(); }} />
        <Pressable onPress={() => { onClose(); onAddPhoto(); }} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Feather name="camera" size={17} color={theme.primary} /><Text style={styles.secondaryActionText}>Upload a shared photo</Text></Pressable>
        <View style={styles.ownerRule}><Feather name="lock" size={14} color={theme.mutedForeground} /><Text style={styles.ownerRuleText}>Owner controls will be enforced by Firebase Security Rules when cloud sync is enabled.</Text></View>
      </View></View>
    </Modal>
  );
}

function MemoryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addMemory } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(formatToday());
  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('A little more detail', 'Add a title and a description so this memory can be found later.');
      return;
    }
    await addMemory({ title, description, date, imageKey: ['coffee', 'letter', 'sunset'][Date.now() % 3] as 'coffee' | 'letter' | 'sunset' });
    setTitle(''); setDescription(''); setDate(formatToday()); onClose();
  };
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}><View style={styles.modalBackdrop}><View style={styles.formSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>New memory</Text><Text style={styles.sheetTitle}>Save this moment.</Text></View><IconButton icon="x" label="Close" onPress={onClose} /></View><Text style={styles.fieldLabel}>Title</Text><TextInput onChangeText={setTitle} placeholder="What should you call it?" placeholderTextColor={theme.mutedForeground} style={styles.input} value={title} /><Text style={[styles.fieldLabel, styles.passwordLabel]}>Description</Text><TextInput multiline onChangeText={setDescription} placeholder="Why does this moment matter?" placeholderTextColor={theme.mutedForeground} style={[styles.input, styles.multilineInput]} value={description} /><Text style={[styles.fieldLabel, styles.passwordLabel]}>Date</Text><TextInput onChangeText={setDate} placeholder="Today" placeholderTextColor={theme.mutedForeground} style={styles.input} value={date} /><PrimaryButton title="Save memory" icon="bookmark" onPress={() => void submit()} /></View></View></Modal>;
}

function PhotoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addPhoto } = useApp();
  const [uri, setUri] = useState('');
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState(formatToday());
  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setUri(result.assets[0].uri);
  };
  const submit = async () => {
    if (!uri) { Alert.alert('Choose a photo', 'Select an image from your library first.'); return; }
    await addPhoto({ uri, caption, date });
    setUri(''); setCaption(''); setDate(formatToday()); onClose();
  };
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}><View style={styles.modalBackdrop}><View style={styles.formSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>Shared photo</Text><Text style={styles.sheetTitle}>Keep it close.</Text></View><IconButton icon="x" label="Close" onPress={onClose} /></View><Pressable onPress={() => void choosePhoto()} style={({ pressed }) => [styles.photoPicker, pressed && styles.pressed]}>{uri ? <Image source={{ uri }} style={styles.pickerImage} /> : <><Feather name="upload-cloud" size={25} color={theme.primary} /><Text style={styles.photoPickerTitle}>Choose a photo</Text><Text style={styles.photoPickerBody}>It will be added to your shared album.</Text></>}</Pressable><Text style={styles.fieldLabel}>Caption</Text><TextInput onChangeText={setCaption} placeholder="A small note about this day" placeholderTextColor={theme.mutedForeground} style={styles.input} value={caption} /><Text style={[styles.fieldLabel, styles.passwordLabel]}>Date</Text><TextInput onChangeText={setDate} placeholder="Today" placeholderTextColor={theme.mutedForeground} style={styles.input} value={date} /><PrimaryButton title="Add to gallery" icon="image" onPress={() => void submit()} /></View></View></Modal>;
}

export default function PrivateWorldApp() {
  const insets = useSafeAreaInsets();
  const { currentUser, isLoading, logout } = useApp();
  const [section, setSection] = useState<AppSection>('home');
  const [ownerVisible, setOwnerVisible] = useState(false);
  const [memoryVisible, setMemoryVisible] = useState(false);
  const [photoVisible, setPhotoVisible] = useState(false);

  if (isLoading) return <View style={[styles.loadingRoot, { paddingTop: insets.top }]}><AppMark size={58} /><Text style={styles.loadingText}>Opening your private world...</Text></View>;
  if (!currentUser) return <LoginScreen />;

  const openMessage = () => setSection('chat');
  return (
    <View style={[styles.appRoot, { paddingTop: Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top }]}>
      <Header onLogout={logout} onOwner={() => setOwnerVisible(true)} />
      <SectionNav section={section} onChange={setSection} />
      {section === 'home' && <HomeSection onNavigate={setSection} onAddMemory={() => setMemoryVisible(true)} onAddPhoto={() => setPhotoVisible(true)} onSendMessage={openMessage} />}
      {section === 'chat' && <ChatSection />}
      {section === 'memories' && <MemoriesSection />}
      {section === 'gallery' && <GallerySection onAddPhoto={() => setPhotoVisible(true)} />}
      <OwnerModal visible={ownerVisible} onClose={() => setOwnerVisible(false)} onAddMemory={() => setMemoryVisible(true)} onAddPhoto={() => setPhotoVisible(true)} />
      <MemoryModal visible={memoryVisible} onClose={() => setMemoryVisible(false)} />
      <PhotoModal visible={photoVisible} onClose={() => setPhotoVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1, backgroundColor: theme.background },
  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background, gap: 16 },
  loadingText: { color: theme.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 14 },
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandName: { color: theme.foreground, fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3 },
  brandCaption: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: theme.card },
  avatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: theme.accent },
  avatarText: { color: theme.accentForeground, fontFamily: 'Inter_700Bold', fontSize: 14 },
  navRow: { marginHorizontal: 16, marginBottom: 4, padding: 4, borderRadius: 17, backgroundColor: theme.secondary, flexDirection: 'row' },
  navItem: { flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 13 },
  navItemActive: { backgroundColor: theme.card, shadowColor: '#6c3748', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  navLabel: { color: theme.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 11 },
  navLabelActive: { color: theme.primary, fontFamily: 'Inter_700Bold' },
  scrollContent: { padding: 20, paddingBottom: 42 },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 20 },
  dateText: { color: theme.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 5 },
  greeting: { color: theme.foreground, fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.8 },
  syncPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, backgroundColor: theme.card },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  syncText: { color: theme.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  heroCard: { minHeight: 190, padding: 20, borderRadius: 28, overflow: 'hidden', marginBottom: 25 },
  heroOrb: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -60, top: -68, backgroundColor: '#fff9f720' },
  heroCopy: { maxWidth: '83%' },
  heroIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff9f72a', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  heroKicker: { color: '#f9dfe6', fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 7 },
  heroTitle: { color: '#fff9f7', fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 29, letterSpacing: -0.7 },
  heroCaption: { color: '#f9dfe6', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 12 },
  heroMore: { position: 'absolute', right: 16, bottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 6 },
  sectionTitle: { color: theme.foreground, fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3 },
  linkText: { color: theme.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  mutedText: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 },
  quickGrid: { flexDirection: 'row', gap: 9, marginBottom: 25 },
  quickAction: { flex: 1, minHeight: 86, padding: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  quickIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  quickLabel: { color: theme.secondaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 10, textAlign: 'center' },
  memoryCard: { minHeight: 225, borderRadius: 24, overflow: 'hidden', backgroundColor: theme.card, marginBottom: 16 },
  memoryCardCompact: { minHeight: 205 },
  memoryImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  memoryOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#2f1f2c65' },
  memoryInfo: { flex: 1, justifyContent: 'flex-end', padding: 18 },
  memoryDate: { color: '#f9dfe6', fontFamily: 'Inter_500Medium', fontSize: 10, marginBottom: 7 },
  memoryTitle: { color: '#fff9f7', fontFamily: 'Inter_700Bold', fontSize: 21, letterSpacing: -0.5 },
  memoryDescription: { color: '#fff9f7', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 7, opacity: 0.9 },
  glanceRow: { flexDirection: 'row', gap: 9, marginBottom: 16 },
  glanceCard: { flex: 1, padding: 14, borderRadius: 19, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  glanceValue: { color: theme.foreground, fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 9 },
  glanceLabel: { color: theme.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 1 },
  lastMessage: { flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 18, backgroundColor: theme.secondary, gap: 10 },
  messageIcon: { width: 35, height: 35, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.card },
  lastMessageCopy: { flex: 1 },
  lastMessageLabel: { color: theme.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 10, marginBottom: 4 },
  lastMessageText: { color: theme.secondaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  chatRoot: { flex: 1, paddingHorizontal: 20 },
  chatIntro: { paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatAvatar: { width: 40, height: 40, borderRadius: 15, backgroundColor: theme.secondary, alignItems: 'center', justifyContent: 'center' },
  chatTitle: { color: theme.foreground, fontFamily: 'Inter_700Bold', fontSize: 17 },
  chatSubtitle: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#62a77a' },
  onlineText: { color: theme.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 10 },
  messageList: { paddingVertical: 13, gap: 13 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRowMine: { justifyContent: 'flex-end' },
  smallAvatar: { width: 25, height: 25, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent, marginBottom: 2 },
  smallAvatarText: { color: theme.accentForeground, fontFamily: 'Inter_700Bold', fontSize: 10 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8, borderRadius: 19 },
  bubbleMine: { backgroundColor: theme.primary, borderBottomRightRadius: 5 },
  bubbleTheirs: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderBottomLeftRadius: 5 },
  bubbleText: { color: theme.foreground, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: theme.primaryForeground },
  bubbleTime: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 5, textAlign: 'right' },
  bubbleTimeMine: { color: '#f9dfe6' },
  composerShell: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 8, marginBottom: Platform.OS === 'web' ? 34 : 12, padding: 6, borderRadius: 23, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  composerInput: { flex: 1, color: theme.foreground, fontFamily: 'Inter_400Regular', fontSize: 14, paddingHorizontal: 12, paddingVertical: 9, minHeight: 38 },
  sendButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary },
  sendButtonDisabled: { backgroundColor: theme.mutedForeground },
  pageHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  pageEyebrow: { color: theme.primary, fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 5 },
  pageTitle: { color: theme.foreground, fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.9 },
  pageDescription: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 24 },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 14, backgroundColor: theme.secondary },
  sortText: { color: theme.primary, fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  timelineLine: { position: 'absolute', width: 1, backgroundColor: theme.border, left: 29, top: 122, bottom: 15 },
  timelineItem: { paddingLeft: 26, position: 'relative' },
  timelineDot: { position: 'absolute', left: 17, top: 16, width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background, zIndex: 2 },
  timelineDotInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.primary },
  timelineConnector: { height: 1, width: 10, backgroundColor: theme.border, position: 'absolute', left: 29, bottom: 24 },
  galleryPreviewRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  galleryPreview: { flex: 1, height: 125, borderRadius: 18 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  galleryTile: { width: '47.8%', borderRadius: 18, overflow: 'hidden', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  galleryImage: { width: '100%', aspectRatio: 1, backgroundColor: theme.secondary },
  galleryCaption: { padding: 9 },
  galleryCaptionText: { color: theme.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  galleryMeta: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 3 },
  emptyState: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 34 },
  emptyIcon: { width: 52, height: 52, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.secondary, marginBottom: 12 },
  emptyTitle: { color: theme.foreground, fontFamily: 'Inter_700Bold', fontSize: 16 },
  emptyBody: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  loginRoot: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 67 : 24, paddingBottom: Platform.OS === 'web' ? 34 : 24 },
  loginGlow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -100, right: -100, backgroundColor: '#ffffff42' },
  loginContent: { alignItems: 'flex-start' },
  eyebrow: { color: theme.primary, fontFamily: 'Inter_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 24, marginBottom: 10 },
  loginTitle: { color: theme.foreground, fontFamily: 'Inter_700Bold', fontSize: 33, lineHeight: 38, letterSpacing: -1.1 },
  loginSubtitle: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 14, maxWidth: 330 },
  loginCard: { width: '100%', padding: 18, borderRadius: 25, backgroundColor: '#fff9f7d9', marginTop: 28, borderWidth: 1, borderColor: '#ffffffb5' },
  fieldLabel: { color: theme.secondaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 11, marginBottom: 7 },
  passwordLabel: { marginTop: 14 },
  input: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: theme.input, backgroundColor: theme.card, color: theme.foreground, fontFamily: 'Inter_400Regular', fontSize: 13, paddingHorizontal: 13 },
  multilineInput: { height: 88, paddingTop: 12, textAlignVertical: 'top' },
  primaryButton: { minHeight: 48, borderRadius: 16, backgroundColor: theme.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, paddingHorizontal: 16 },
  primaryButtonText: { color: theme.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 13 },
  disabledButton: { opacity: 0.6 },
  errorText: { color: theme.destructive, fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 10 },
  demoHint: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15 },
  demoHintText: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, flex: 1, lineHeight: 15 },
  loginFooter: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', marginTop: 22 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#2f1f2c70' },
  ownerSheet: { padding: 20, paddingBottom: Platform.OS === 'web' ? 34 : 28, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: theme.background },
  formSheet: { padding: 20, paddingBottom: Platform.OS === 'web' ? 34 : 28, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: theme.background, maxHeight: '92%' },
  sheetHandle: { alignSelf: 'center', width: 35, height: 4, borderRadius: 2, backgroundColor: theme.border, marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sheetEyebrow: { color: theme.primary, fontFamily: 'Inter_600SemiBold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 5 },
  sheetTitle: { color: theme.foreground, fontFamily: 'Inter_700Bold', fontSize: 23, letterSpacing: -0.5, maxWidth: 290 },
  sheetDescription: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 12, marginBottom: 5 },
  secondaryAction: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  secondaryActionText: { color: theme.primary, fontFamily: 'Inter_700Bold', fontSize: 13 },
  ownerRule: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 20, padding: 12, borderRadius: 15, backgroundColor: theme.secondary },
  ownerRuleText: { flex: 1, color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 },
  photoPicker: { minHeight: 125, borderRadius: 19, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.primary, backgroundColor: theme.secondary, alignItems: 'center', justifyContent: 'center', marginTop: 20, overflow: 'hidden' },
  pickerImage: { width: '100%', height: 170 },
  photoPickerTitle: { color: theme.primary, fontFamily: 'Inter_700Bold', fontSize: 13, marginTop: 8 },
  photoPickerBody: { color: theme.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },
  pressed: { opacity: 0.72 },
});