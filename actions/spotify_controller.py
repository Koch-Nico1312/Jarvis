"""
Spotify Controller for JARVIS
Controls Spotify music playback using Spotify Web API
"""

from pathlib import Path
from typing import Callable, Optional

try:
    import spotipy
    from spotipy.oauth2 import SpotifyOAuth
    SPOTIFY_AVAILABLE = True
except ImportError:
    SPOTIFY_AVAILABLE = False

from config.config_loader import get_config


class SpotifyController:
    """Manages Spotify playback control"""
    
    SCOPES = [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'playlist-read-private',
        'user-library-read'
    ]
    
    def __init__(self):
        self.config = get_config()
        self.sp = None
        self.cache_path = None
        
        if not SPOTIFY_AVAILABLE:
            print("[Spotify] ⚠️ spotipy not available")
            return
        
        # Get credentials from config
        client_id = self.config.get('spotify.client_id', '')
        client_secret = self.config.get('spotify.client_secret', '')
        redirect_uri = self.config.get('spotify.redirect_uri', 'http://localhost:8888/callback')
        
        if not client_id or not client_secret:
            print("[Spotify] ⚠️ Client ID or Secret not configured")
            return
        
        # Set cache path
        base_dir = Path(self.config.get('paths.base_dir', '.'))
        self.cache_path = base_dir / "config" / "spotify_token_cache"
        
        try:
            self.sp = spotipy.Spotify(
                auth_manager=SpotifyOAuth(
                    client_id=client_id,
                    client_secret=client_secret,
                    redirect_uri=redirect_uri,
                    scope=' '.join(self.SCOPES),
                    cache_path=str(self.cache_path),
                    open_browser=False
                )
            )
            print("[Spotify] ✅ Initialized")
        except Exception as e:
            print(f"[Spotify] ❌ Initialization failed: {e}")
    
    def play(self, query: str = None) -> str:
        """Play a song, playlist, or album"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            if query:
                # Search for the query
                results = self.sp.search(q=query, type='track', limit=1)
                if results['tracks']['items']:
                    track_uri = results['tracks']['items'][0]['uri']
                    self.sp.start_playback(uris=[track_uri])
                    track_name = results['tracks']['items'][0]['name']
                    artist_name = results['tracks']['items'][0]['artists'][0]['name']
                    print(f"[Spotify] ✅ Playing: {track_name} by {artist_name}")
                    return f"Playing {track_name} by {artist_name}, sir."
                else:
                    return f"No results found for '{query}', sir."
            else:
                # Resume playback
                self.sp.start_playback()
                print("[Spotify] ✅ Resumed playback")
                return "Resumed playback, sir."
        except Exception as e:
            print(f"[Spotify] ❌ Play error: {e}")
            return f"Failed to play: {e}"
    
    def pause(self) -> str:
        """Pause playback"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            self.sp.pause_playback()
            print("[Spotify] ✅ Paused")
            return "Paused, sir."
        except Exception as e:
            print(f"[Spotify] ❌ Pause error: {e}")
            return f"Failed to pause: {e}"
    
    def resume(self) -> str:
        """Resume playback"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            self.sp.start_playback()
            print("[Spotify] ✅ Resumed")
            return "Resumed, sir."
        except Exception as e:
            print(f"[Spotify] ❌ Resume error: {e}")
            return f"Failed to resume: {e}"
    
    def next(self) -> str:
        """Skip to next track"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            self.sp.next_track()
            print("[Spotify] ✅ Skipped to next")
            return "Skipped to next track, sir."
        except Exception as e:
            print(f"[Spotify] ❌ Next error: {e}")
            return f"Failed to skip: {e}"
    
    def previous(self) -> str:
        """Skip to previous track"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            self.sp.previous_track()
            print("[Spotify] ✅ Skipped to previous")
            return "Skipped to previous track, sir."
        except Exception as e:
            print(f"[Spotify] ❌ Previous error: {e}")
            return f"Failed to skip: {e}"
    
    def current(self) -> str:
        """Get currently playing track"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            current = self.sp.current_user_playing_track()
            if current and current['item']:
                track = current['item']
                name = track['name']
                artists = ', '.join([a['name'] for a in track['artists']])
                album = track['album']['name']
                is_playing = current['is_playing']
                status = "Playing" if is_playing else "Paused"
                print(f"[Spotify] ✅ Current: {name} by {artists}")
                return f"{status}: {name} by {artists} from {album}"
            else:
                return "Nothing is currently playing, sir."
        except Exception as e:
            print(f"[Spotify] ❌ Current error: {e}")
            return f"Failed to get current track: {e}"
    
    def volume(self, value: int) -> str:
        """Set volume (0-100)"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            self.sp.volume(value)
            print(f"[Spotify] ✅ Volume set to {value}")
            return f"Volume set to {value}, sir."
        except Exception as e:
            print(f"[Spotify] ❌ Volume error: {e}")
            return f"Failed to set volume: {e}"
    
    def search(self, query: str, search_type: str = 'track') -> str:
        """Search for music"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            results = self.sp.search(q=query, type=search_type, limit=5)
            
            if search_type == 'track':
                items = results['tracks']['items']
                if not items:
                    return f"No tracks found for '{query}', sir."
                
                result = f"Found {len(items)} tracks:\n\n"
                for i, track in enumerate(items, 1):
                    name = track['name']
                    artists = ', '.join([a['name'] for a in track['artists']])
                    result += f"{i}. {name} by {artists}\n"
                return result
            
            elif search_type == 'playlist':
                items = results['playlists']['items']
                if not items:
                    return f"No playlists found for '{query}', sir."
                
                result = f"Found {len(items)} playlists:\n\n"
                for i, playlist in enumerate(items, 1):
                    name = playlist['name']
                    owner = playlist['owner']['display_name']
                    result += f"{i}. {name} by {owner}\n"
                return result
            
            elif search_type == 'album':
                items = results['albums']['items']
                if not items:
                    return f"No albums found for '{query}', sir."
                
                result = f"Found {len(items)} albums:\n\n"
                for i, album in enumerate(items, 1):
                    name = album['name']
                    artists = ', '.join([a['name'] for a in album['artists']])
                    result += f"{i}. {name} by {artists}\n"
                return result
            
            elif search_type == 'artist':
                items = results['artists']['items']
                if not items:
                    return f"No artists found for '{query}', sir."
                
                result = f"Found {len(items)} artists:\n\n"
                for i, artist in enumerate(items, 1):
                    name = artist['name']
                    result += f"{i}. {name}\n"
                return result
            
            else:
                return f"Unknown search type: {search_type}"
            
        except Exception as e:
            print(f"[Spotify] ❌ Search error: {e}")
            return f"Failed to search: {e}"
    
    def queue(self, query: str) -> str:
        """Add song to queue"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            results = self.sp.search(q=query, type='track', limit=1)
            if results['tracks']['items']:
                track_uri = results['tracks']['items'][0]['uri']
                self.sp.add_to_queue(uri=track_uri)
                track_name = results['tracks']['items'][0]['name']
                print(f"[Spotify] ✅ Added to queue: {track_name}")
                return f"Added {track_name} to queue, sir."
            else:
                return f"No results found for '{query}', sir."
        except Exception as e:
            print(f"[Spotify] ❌ Queue error: {e}")
            return f"Failed to add to queue: {e}"
    
    def playlists(self) -> str:
        """List user playlists"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            results = self.sp.current_user_playlists(limit=20)
            playlists = results['items']
            
            if not playlists:
                return "No playlists found, sir."
            
            result = f"Found {len(playlists)} playlists:\n\n"
            for i, playlist in enumerate(playlists, 1):
                name = playlist['name']
                owner = playlist['owner']['display_name']
                result += f"{i}. {name} by {owner}\n"
            
            return result
            
        except Exception as e:
            print(f"[Spotify] ❌ Playlists error: {e}")
            return f"Failed to get playlists: {e}"
    
    def shuffle(self, state: str) -> str:
        """Toggle shuffle (on/off)"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            shuffle_state = state.lower() == 'on'
            self.sp.shuffle(state=shuffle_state)
            print(f"[Spotify] ✅ Shuffle set to {state}")
            return f"Shuffle set to {state}, sir."
        except Exception as e:
            print(f"[Spotify] ❌ Shuffle error: {e}")
            return f"Failed to set shuffle: {e}"
    
    def repeat(self, state: str) -> str:
        """Set repeat mode (off/track/context)"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            self.sp.repeat(state=state)
            print(f"[Spotify] ✅ Repeat set to {state}")
            return f"Repeat set to {state}, sir."
        except Exception as e:
            print(f"[Spotify] ❌ Repeat error: {e}")
            return f"Failed to set repeat: {e}"
    
    def devices(self) -> str:
        """List available devices"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            devices = self.sp.devices()['devices']
            
            if not devices:
                return "No devices found, sir."
            
            result = f"Found {len(devices)} devices:\n\n"
            for i, device in enumerate(devices, 1):
                name = device['name']
                device_type = device['type']
                is_active = device['is_active']
                status = " (Active)" if is_active else ""
                result += f"{i}. {name} ({device_type}){status}\n"
            
            return result
            
        except Exception as e:
            print(f"[Spotify] ❌ Devices error: {e}")
            return f"Failed to get devices: {e}"
    
    def transfer(self, device_name: str) -> str:
        """Transfer playback to another device"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            devices = self.sp.devices()['devices']
            device_id = None
            
            for device in devices:
                if device_name.lower() in device['name'].lower():
                    device_id = device['id']
                    break
            
            if not device_id:
                return f"Device '{device_name}' not found, sir."
            
            self.sp.transfer_playback(device_id=device_id, force_play=True)
            print(f"[Spotify] ✅ Transferred to {device_name}")
            return f"Transferred playback to {device_name}, sir."
            
        except Exception as e:
            print(f"[Spotify] ❌ Transfer error: {e}")
            return f"Failed to transfer: {e}"
    
    def liked(self) -> str:
        """Play liked songs"""
        if not self.sp:
            return "Spotify not available, sir."
        
        try:
            results = self.sp.current_user_saved_tracks(limit=1)
            if results['items']:
                track_uri = results['items'][0]['track']['uri']
                self.sp.start_playback(context_uri=None, uris=[track_uri])
                print("[Spotify] ✅ Playing liked songs")
                return "Playing liked songs, sir."
            else:
                return "No liked songs found, sir."
        except Exception as e:
            print(f"[Spotify] ❌ Liked error: {e}")
            return f"Failed to play liked songs: {e}"


# Global instance
_spotify_controller: Optional[SpotifyController] = None


def get_spotify_controller() -> SpotifyController:
    """Get the global Spotify controller instance"""
    global _spotify_controller
    if _spotify_controller is None:
        _spotify_controller = SpotifyController()
    return _spotify_controller


def spotify_controller(parameters: dict, response=None, player=None,
                      speak: Callable = None, session_memory=None) -> str:
    """
    Spotify control tool for JARVIS
    
    Actions:
    - play: Play a song/playlist/album
    - pause: Pause playback
    - resume: Resume playback
    - next: Skip to next track
    - previous: Skip to previous track
    - current: Show currently playing track
    - volume: Set volume (0-100)
    - search: Search for music
    - queue: Add song to queue
    - playlists: List user playlists
    - shuffle: Toggle shuffle (on/off)
    - repeat: Set repeat mode (off/track/context)
    - devices: List available devices
    - transfer: Transfer playback to another device
    - liked: Play liked songs
    """
    action = parameters.get('action', 'current')
    
    spotify = get_spotify_controller()
    
    if action == 'play':
        query = parameters.get('query')
        result = spotify.play(query)
        if speak:
            speak(result)
        return result
    
    elif action == 'pause':
        result = spotify.pause()
        if speak:
            speak(result)
        return result
    
    elif action == 'resume':
        result = spotify.resume()
        if speak:
            speak(result)
        return result
    
    elif action == 'next':
        result = spotify.next()
        if speak:
            speak(result)
        return result
    
    elif action == 'previous':
        result = spotify.previous()
        if speak:
            speak(result)
        return result
    
    elif action == 'current':
        result = spotify.current()
        if speak:
            speak(result)
        return result
    
    elif action == 'volume':
        value = parameters.get('value')
        if value is None:
            return "Please provide a volume level (0-100), sir."
        result = spotify.volume(value)
        if speak:
            speak(result)
        return result
    
    elif action == 'search':
        query = parameters.get('query')
        search_type = parameters.get('type', 'track')
        if not query:
            return "Please provide a search query, sir."
        result = spotify.search(query, search_type)
        if speak:
            speak(f"Found results for {query}, sir.")
        return result
    
    elif action == 'queue':
        query = parameters.get('query')
        if not query:
            return "Please provide a song to queue, sir."
        result = spotify.queue(query)
        if speak:
            speak(result)
        return result
    
    elif action == 'playlists':
        result = spotify.playlists()
        if speak:
            speak(f"Found your playlists, sir.")
        return result
    
    elif action == 'shuffle':
        state = parameters.get('state', 'on')
        result = spotify.shuffle(state)
        if speak:
            speak(result)
        return result
    
    elif action == 'repeat':
        state = parameters.get('state', 'off')
        result = spotify.repeat(state)
        if speak:
            speak(result)
        return result
    
    elif action == 'devices':
        result = spotify.devices()
        if speak:
            speak(f"Found {result.count(chr(10))} devices, sir.")
        return result
    
    elif action == 'transfer':
        device_name = parameters.get('device_name')
        if not device_name:
            return "Please provide a device name, sir."
        result = spotify.transfer(device_name)
        if speak:
            speak(result)
        return result
    
    elif action == 'liked':
        result = spotify.liked()
        if speak:
            speak(result)
        return result
    
    else:
        return f"Unknown action: {action}. Available: play, pause, resume, next, previous, current, volume, search, queue, playlists, shuffle, repeat, devices, transfer, liked"
