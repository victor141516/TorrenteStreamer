<?php

$url = 'http://192.168.1.3:8080/login';
$fields = array(
    'username' => urlencode($_POST['username']),
    'password' => urlencode($_POST['password']),
);

//url-ify the data for the POST
$fields_string ="";
foreach($fields as $key=>$value) { $fields_string .= $key.'='.$value.'&'; }
rtrim($fields_string, '&');

//open connection
$ch = curl_init();

//set the url, number of POST vars, POST data
curl_setopt($ch,CURLOPT_URL, $url);
curl_setopt($ch,CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch,CURLOPT_HEADER, 1);
curl_setopt($ch,CURLOPT_POST, count($fields));
curl_setopt($ch,CURLOPT_POSTFIELDS, $fields_string);

//execute post
$result = curl_exec($ch);

preg_match_all('/^Set-Cookie:\s*([^;]*)/mi', $result, $matches);
$cookies = array();
foreach($matches[1] as $item) {
    parse_str($item, $cookie);
    $cookies = array_merge($cookies, $cookie);
}


//close connection
curl_close($ch);

if (!isset($cookies['SID'])) {
    echo 'Login failed';
    exit();
}

setcookie('SID', $cookies['SID'], 0, '/');
header("Location: /torrent.html");
exit();

?>