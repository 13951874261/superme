export interface VoiceOption {
  id: string;
  name: string;
  country: string;
  gender: 'M' | 'F';
  countryCode: string;
  highlight?: boolean;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'en-GB-LibbyNeural', name: 'Libby', country: '英国 (UK)', gender: 'F', countryCode: 'GB' },
  { id: 'en-GB-MaisieNeural', name: 'Maisie', country: '英国 (UK)', gender: 'F', countryCode: 'GB' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', country: '英国 (UK)', gender: 'M', countryCode: 'GB' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia', country: '英国 (UK)', gender: 'F', countryCode: 'GB' },
  { id: 'en-GB-ThomasNeural', name: 'Thomas', country: '英国 (UK)', gender: 'M', countryCode: 'GB' },
  
  { id: 'en-US-EmmaNeural', name: 'Emma', country: '美国 (US)', gender: 'F', countryCode: 'US' },
  { id: 'en-US-AvaNeural', name: 'Ava', country: '美国 (US)', gender: 'F', countryCode: 'US' },
  { id: 'en-US-AndrewNeural', name: 'Andrew', country: '美国 (US)', gender: 'M', countryCode: 'US' },
  { id: 'en-US-BrianNeural', name: 'Brian', country: '美国 (US)', gender: 'M', countryCode: 'US' },
  { id: 'en-US-AnaNeural', name: 'Ana', country: '美国 (US)', gender: 'F', countryCode: 'US', highlight: true },
  { id: 'en-US-AriaNeural', name: 'Aria', country: '美国 (US)', gender: 'F', countryCode: 'US' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher', country: '美国 (US)', gender: 'M', countryCode: 'US' },
  { id: 'en-US-EricNeural', name: 'Eric', country: '美国 (US)', gender: 'M', countryCode: 'US' },
  { id: 'en-US-GuyNeural', name: 'Guy', country: '美国 (US)', gender: 'M', countryCode: 'US' },
  { id: 'en-US-JennyNeural', name: 'Jenny', country: '美国 (US)', gender: 'F', countryCode: 'US' },
  { id: 'en-US-MichelleNeural', name: 'Michelle', country: '美国 (US)', gender: 'F', countryCode: 'US' },
  { id: 'en-US-RogerNeural', name: 'Roger', country: '美国 (US)', gender: 'M', countryCode: 'US' },
  { id: 'en-US-SteffanNeural', name: 'Steffan', country: '美国 (US)', gender: 'M', countryCode: 'US' },
  
  { id: 'en-US-AndrewMultilingualNeural', name: 'AndrewMultilingual', country: '美国 (US)', gender: 'M', countryCode: 'US' },
  { id: 'en-US-AvaMultilingualNeural', name: 'AvaMultilingual', country: '美国 (US)', gender: 'F', countryCode: 'US' },
  { id: 'en-US-BrianMultilingualNeural', name: 'BrianMultilingual', country: '美国 (US)', gender: 'M', countryCode: 'US' },
  { id: 'en-US-EmmaMultilingualNeural', name: 'EmmaMultilingual', country: '美国 (US)', gender: 'F', countryCode: 'US' },

  { id: 'en-AU-WilliamMultilingualNeural', name: 'WilliamMultilingual', country: '澳大利亚 (AU)', gender: 'M', countryCode: 'AU' },
  { id: 'en-AU-NatashaNeural', name: 'Natasha', country: '澳大利亚 (AU)', gender: 'F', countryCode: 'AU' },
  { id: 'en-CA-ClaraNeural', name: 'Clara', country: '加拿大 (CA)', gender: 'F', countryCode: 'CA' },
  { id: 'en-CA-LiamNeural', name: 'Liam', country: '加拿大 (CA)', gender: 'M', countryCode: 'CA' },
  
  { id: 'en-HK-YanNeural', name: 'Yan', country: '中国香港 (HK)', gender: 'F', countryCode: 'HK' },
  { id: 'en-HK-SamNeural', name: 'Sam', country: '中国香港 (HK)', gender: 'M', countryCode: 'HK' },
  { id: 'en-IN-NeerjaNeural', name: 'Neerja', country: '印度 (IN)', gender: 'F', countryCode: 'IN' },
  { id: 'en-IN-PrabhatNeural', name: 'Prabhat', country: '印度 (IN)', gender: 'M', countryCode: 'IN' },
  { id: 'en-IE-ConnorNeural', name: 'Connor', country: '爱尔兰 (IE)', gender: 'M', countryCode: 'IE' },
  { id: 'en-IE-EmilyNeural', name: 'Emily', country: '爱尔兰 (IE)', gender: 'F', countryCode: 'IE' },
  { id: 'en-KE-AsiliaNeural', name: 'Asilia', country: '肯尼亚 (KE)', gender: 'F', countryCode: 'KE' },
  { id: 'en-KE-ChilembaNeural', name: 'Chilemba', country: '肯尼亚 (KE)', gender: 'M', countryCode: 'KE' },
  { id: 'en-NZ-MitchellNeural', name: 'Mitchell', country: '新西兰 (NZ)', gender: 'M', countryCode: 'NZ' },
  { id: 'en-NZ-MollyNeural', name: 'Molly', country: '新西兰 (NZ)', gender: 'F', countryCode: 'NZ' },
  { id: 'en-NG-AbeoNeural', name: 'Abeo', country: '尼日利亚 (NG)', gender: 'M', countryCode: 'NG' },
  { id: 'en-NG-EzinneNeural', name: 'Ezinne', country: '尼日利亚 (NG)', gender: 'F', countryCode: 'NG' },
  { id: 'en-PH-JamesNeural', name: 'James', country: '菲律宾 (PH)', gender: 'M', countryCode: 'PH' },
  { id: 'en-PH-RosaNeural', name: 'Rosa', country: '菲律宾 (PH)', gender: 'F', countryCode: 'PH' },
  { id: 'en-SG-LunaNeural', name: 'Luna', country: '新加坡 (SG)', gender: 'F', countryCode: 'SG' },
  { id: 'en-SG-WayneNeural', name: 'Wayne', country: '新加坡 (SG)', gender: 'M', countryCode: 'SG' },
  { id: 'en-ZA-LeahNeural', name: 'Leah', country: '南非 (ZA)', gender: 'F', countryCode: 'ZA' },
  { id: 'en-ZA-LukeNeural', name: 'Luke', country: '南非 (ZA)', gender: 'M', countryCode: 'ZA' },
  { id: 'en-TZ-ElimuNeural', name: 'Elimu', country: '坦桑尼亚 (TZ)', gender: 'M', countryCode: 'TZ' },
  { id: 'en-TZ-ImaniNeural', name: 'Imani', country: '坦桑尼亚 (TZ)', gender: 'F', countryCode: 'TZ' },
];
