//A seperate js document for the changes i add that dont directly affect the other code, just so i can have some semblance
//of structure for my addons >w>
var audioPlayer = document.getElementById('audioPlayer');
var hoverSounds = document.querySelectorAll(".hovers");

var buttons = document.querySelectorAll(".amog");
console.log(buttons[0]);


buttons.forEach(addAudioListener);
function addAudioListener(item, index) {
    console.log(item);
            buttons[index].addEventListener('mouseenter', hoverSoundSelection);
}

function hoverSoundSelection(){
    var randNum = (Math.floor(Math.random() * 5));
    hoverSounds[randNum].load();
    hoverSounds[randNum].play().catch(error => {
      console.error('Playback failed: amogus', error);
    });
}
function play(){
    audioPlayer.load(); // reload the audio player so that the audio restarts from the beginning on each click
    audioPlayer.play().catch(error => {
      console.error('Playback failed: amogus', error);
    });
}
