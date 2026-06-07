export interface VoiceOption {
  id: string;
  name: string;
  country: string;
  gender: 'M' | 'F';
  flag: string;
  highlight?: boolean;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'en-GB-LibbyNeural', name: 'Libby', country: '英国 (UK)', gender: 'F', flag: '🇬🇧' },
  { id: 'en-GB-MaisieNeural', name: 'Maisie', country: '英国 (UK)', gender: 'F', flag: '🇬🇧' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', country: '英国 (UK)', gender: 'M', flag: '🇬🇧' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia', country: '英国 (UK)', gender: 'F', flag: '🇬🇧' },
  { id: 'en-GB-ThomasNeural', name: 'Thomas', country: '英国 (UK)', gender: 'M', flag: '🇬🇧' },
  
  { id: 'en-US-EmmaNeural', name: 'Emma', country: '美国 (US)', gender: 'F', flag: '🇺🇸' },
  { id: 'en-US-AvaNeural', name: 'Ava', country: '美国 (US)', gender: 'F', flag: '🇺🇸' },
  { id: 'en-US-AndrewNeural', name: 'Andrew', country: '美国 (US)', gender: 'M', flag: '🇺🇸' },
  { id: 'en-US-BrianNeural', name: 'Brian', country: '美国 (US)', gender: 'M', flag: '🇺🇸' },
  { id: 'en-US-AnaNeural', name: 'Ana', country: '美国 (US)', gender: 'F', flag: '🇺🇸', highlight: true },
  { id: 'en-US-AriaNeural', name: 'Aria', country: '美国 (US)', gender: 'F', flag: '🇺🇸' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher', country: '美国 (US)', gender: 'M', flag: '🇺🇸' },
  { id: 'en-US-EricNeural', name: 'Eric', country: '美国 (US)', gender: 'M', flag: '🇺🇸' },
  { id: 'en-US-GuyNeural', name: 'Guy', country: '美国 (US)', gender: 'M', flag: '🇺🇸' },
  { id: 'en-US-JennyNeural', name: 'Jenny', country: '美国 (US)', gender: 'F', flag: '🇺🇸' },
  { id: 'en-US-MichelleNeural', name: 'Michelle', country: '美国 (US)', gender: 'F', flag: '🇺🇸' },
  { id: 'en-US-RogerNeural', name: 'Roger', country: '美国 (US)', gender: 'M', flag: '🇺🇸' },
  { id: 'en-US-SteffanNeural', name: 'Steffan', country: '美国 (US)', gender: 'M', flag: '🇺🇸' },
  
  { id: 'en-US-AndrewMultilingualNeural', name: 'AndrewMultilingual', country: '美国 (US)', gender: 'M', flag: '🇺🇸' },
  { id: 'en-US-AvaMultilingualNeural', name: 'AvaMultilingual', country: '美国 (US)', gender: 'F', flag: '🇺🇸' },
  { id: 'en-US-BrianMultilingualNeural', name: 'BrianMultilingual', country: '美国 (US)', gender: 'M', flag: '🇺🇸' },
  { id: 'en-US-EmmaMultilingualNeural', name: 'EmmaMultilingual', country: '美国 (US)', gender: 'F', flag: '🇺🇸' },

  { id: 'en-AU-WilliamMultilingualNeural', name: 'WilliamMultilingual', country: '澳大利亚 (AU)', gender: 'M', flag: '🇦🇺' },
  { id: 'en-AU-NatashaNeural', name: 'Natasha', country: '澳大利亚 (AU)', gender: 'F', flag: '🇦🇺' },
  { id: 'en-CA-ClaraNeural', name: 'Clara', country: '加拿大 (CA)', gender: 'F', flag: '🇨🇦' },
  { id: 'en-CA-LiamNeural', name: 'Liam', country: '加拿大 (CA)', gender: 'M', flag: '🇨🇦' },
  
  { id: 'en-HK-YanNeural', name: 'Yan', country: '中国香港 (HK)', gender: 'F', flag: '🇭🇰' },
  { id: 'en-HK-SamNeural', name: 'Sam', country: '中国香港 (HK)', gender: 'M', flag: '🇭🇰' },
  { id: 'en-IN-NeerjaNeural', name: 'Neerja', country: '印度 (IN)', gender: 'F', flag: '🇮🇳' },
  { id: 'en-IN-PrabhatNeural', name: 'Prabhat', country: '印度 (IN)', gender: 'M', flag: '🇮🇳' },
  { id: 'en-IE-ConnorNeural', name: 'Connor', country: '爱尔兰 (IE)', gender: 'M', flag: '🇮🇪' },
  { id: 'en-IE-EmilyNeural', name: 'Emily', country: '爱尔兰 (IE)', gender: 'F', flag: '🇮🇪' },
  { id: 'en-KE-AsiliaNeural', name: 'Asilia', country: '肯尼亚 (KE)', gender: 'F', flag: '🇰🇪' },
  { id: 'en-KE-ChilembaNeural', name: 'Chilemba', country: '肯尼亚 (KE)', gender: 'M', flag: '🇰🇪' },
  { id: 'en-NZ-MitchellNeural', name: 'Mitchell', country: '新西兰 (NZ)', gender: 'M', flag: '🇳🇿' },
  { id: 'en-NZ-MollyNeural', name: 'Molly', country: '新西兰 (NZ)', gender: 'F', flag: '🇳🇿' },
  { id: 'en-NG-AbeoNeural', name: 'Abeo', country: '尼日利亚 (NG)', gender: 'M', flag: '🇳🇬' },
  { id: 'en-NG-EzinneNeural', name: 'Ezinne', country: '尼日利亚 (NG)', gender: 'F', flag: '🇳🇬' },
  { id: 'en-PH-JamesNeural', name: 'James', country: '菲律宾 (PH)', gender: 'M', flag: '🇵🇭' },
  { id: 'en-PH-RosaNeural', name: 'Rosa', country: '菲律宾 (PH)', gender: 'F', flag: '🇵🇭' },
  { id: 'en-SG-LunaNeural', name: 'Luna', country: '新加坡 (SG)', gender: 'F', flag: '🇸🇬' },
  { id: 'en-SG-WayneNeural', name: 'Wayne', country: '新加坡 (SG)', gender: 'M', flag: '🇸🇬' },
  { id: 'en-ZA-LeahNeural', name: 'Leah', country: '南非 (ZA)', gender: 'F', flag: '🇿🇦' },
  { id: 'en-ZA-LukeNeural', name: 'Luke', country: '南非 (ZA)', gender: 'M', flag: '🇿🇦' },
  { id: 'en-TZ-ElimuNeural', name: 'Elimu', country: '坦桑尼亚 (TZ)', gender: 'M', flag: '🇹🇿' },
  { id: 'en-TZ-ImaniNeural', name: 'Imani', country: '坦桑尼亚 (TZ)', gender: 'F', flag: '🇹🇿' },
];
