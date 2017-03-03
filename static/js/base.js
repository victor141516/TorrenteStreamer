function prepareDropFile() {
    window.addEventListener("dragenter", function(e) {
        lastTarget = e.target;
        document.querySelector(".dropzone").style.visibility = "";
        document.querySelector(".dropzone").style.opacity = 1;
    });

    window.addEventListener("dragleave", function(e) {
        if (e.target === lastTarget) {
            document.querySelector(".dropzone").style.visibility = "hidden";
            document.querySelector(".dropzone").style.opacity = 0;
        }
    });
    window.addEventListener("dragover", function (e) {
        e.preventDefault();
    });
    window.addEventListener("drop", function (e) {
        e.preventDefault();
        document.querySelector(".dropzone").style.visibility = "hidden";
        document.querySelector(".dropzone").style.opacity = 0;
    });
}

function hasClass(element, cls) {
    return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
}

function addSubtitle(file) {
    var formData = new FormData();
    var xhr = new XMLHttpRequest();
    formData.append('subtitle', file);
    xhr.open('post', '/subtitle', true);
    xhr.send(formData);
    xhr.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var sub_src = this.responseText;
            videojs('player').addRemoteTextTrack({'src': '/subtitle/' + sub_src, 'kind': 'subtitles', 'language': 'Your subtitle'});
            var timer = setInterval(function() {
               if (!hasClass(document.getElementsByClassName("vjs-subtitles-button")[0], 'vjs-hidden')) {
                   document.getElementsByClassName("vjs-subtitles-button")[0].click();
                   var subs = document.getElementsByClassName("vjs-menu-item");
                   for (i = 0; i < subs.length; i++) {
                        if (!hasClass(subs[i], 'vjs-selected')) {
                            subs[i].click();
                        }
                    }
                   clearInterval(timer);
               }
            }, 200);
        }
    };
}