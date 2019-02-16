# Photolab_hack  
***This solution has become one of 4 winners of the hackathon 1st stage.***

## Goal  
Create potentially viral app for the [Photolab](https://photolab.me/) audience.  

## Idea  
So we decided to create something fairly simple: what if we let users swap faces from several input photos with arbitrary number of people to another photo with some crowd, in fully unsupervised way. The result is then posted on facebook and can be used to challenge their friends to find someone familiar in the mixed photos.  
Our web service must be easy to use, able to create high-quality swaps and make it fast.

## Implementation  
Here is the algorithm:  
 1. Find all faces on both input and output photos. Let's use detector, [based on HOG descriptors](http://dlib.net/face_detector.py.html) for that.  
 2. Extract features from detected faces with [pretrained model](http://dlib.net/face_recognition.py.html) (any "metric learning" model for face-recognition can be used, like facenet). For instance, we map every face to the 128D space. Then we measure L2 distances in this face-features space, between every face in the input photo and faces in the destination photo. And finaly, for every "input face" we must find "nearest neighbour" from the distanation photo. Here is the illustration:  
 
<img src="https://github.com/gasparian/photolab_hack/blob/master/imgs/photolab_hack_emb.jpg" height=450>  

 3. After we formed all pairs of faces, we need to get landmarks for every face to be able warp it while swapping. Again, we can use pretrained dlib's [landmarks predictor](http://dlib.net/face_landmark_detection.py.html).  
 4. Finally do the [face-swapping](https://github.com/wuhuikai/FaceSwap)!   
    Basically we can go two ways:  
    - use only affine transform on "source" face mask (*aka* warp_2d in code);  
    - apply [delaunay triangulation](https://en.wikipedia.org/wiki/Delaunay_triangulation) on "source" and destination faces landmarks and warp each triangle of source face (*aka* warp_3d in code). This approach leads to more accurate facial expressions transfer;  
    
    <img src="https://github.com/gasparian/photolab_hack/blob/master/imgs/1_wh1N-kogDMaZYS17lqyqeQ.jpeg" height=250>  
    
    In our case, simple heuristic works just fine: do the triangulation only if detected face bbox is big enough to fill `k <= bbox_h/img_h` of image height (where `k` is a given value).  

## Example  
User start from choosing couple photos of him and / or his friend(s) and the photo where input faces should be placed:  

<img src="https://github.com/gasparian/photolab_hack/blob/master/imgs/onboarding_1.jpg" height=500> <img src="https://github.com/gasparian/photolab_hack/blob/master/imgs/inputs.jpg" height=500> <img src="https://github.com/gasparian/photolab_hack/blob/master/imgs/pre_mix.jpg" height=500>  

And after **~2 sec.** he gets the result and can share it on various social platforms:  

<img src="https://github.com/gasparian/photolab_hack/blob/master/imgs/mixed_zoomed.jpg" height=500>  

As you can see, we really swapped the most similar faces and did it pretty well.

## Deploying service  
1. Install docker.
2. Pull last image version to your machine from [dockerhub](https://cloud.docker.com/repository/docker/gasparjan/photolab_hack/general):
 ```
 docker pull gasparjan/photolab_hack:latest
 ```
3. AWS S3 used to store uploaded images. So you need to configure access to S3 on the host machine:
 - go to .aws folder:
 ```
 cd ~/.aws
 ```
 - create config file and fill it with user name:
 ```
 [profile %USER_NAME%]
 ```
 - create credentials file and fill it with secret keys:
 ```
 [%USER_NAME%]
 
 aws_access_key_id = AAAAAAAAAAAAAAAAAAA
 aws_secret_access_key = RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
 ```
4. Run docker:
 ```
 docker run --rm -it -v /tmp:/tmp -v /root/.aws:/root/.aws \
            -p 8080:8000 --ipc=host gasparjan/photolab_hack:latest
 ```
 or go to the project folder and run bash script:
 ```
 cd ~/photolab_hack
 ./run_docker.sh
 ```  
Server starts automatically.
