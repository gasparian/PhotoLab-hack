# photolab_hack  
## Goal  
Create app with viral potential for the [Photolab](https://photolab.me/) audience.  

## Idea  
So we decided to create something fairly simple: what if let users swap faces from several input photos with arbitrary number of people to another photo with some crowd, in fully unsupervised way. The result is then posted on facebook and can be used to challenge their friends to find someone familiar in the photos. 
Our web service must be easy to use, able to create high-quality swaps and make it fast.

## Implementation  
Here is the algorithm:  
 1. Find all faces on both input and output photos. Let's use [HOG-based detector](http://dlib.net/face_detector.py.html) for that.  
 2. Extract features from detected faces with pretrained model (any metric learning model for face-recognition, like facenet). For instance, we map every face to the 128D space. Then we measure L2 distances in this face-features space, between every face in the input photo and faces in the destination photo. And finaly, for every "input face" we must get "nearest neighbour" from the distanation photo. Here is the illustration:  
 
<img src="https://github.com/gasparian/photolab_hack/blob/master/imgs/photolab_hack_emb.jpg" height=450>  

 3. sss

## Example  
<img src="https://github.com/gasparian/photolab_hack/blob/master/imgs/onboarding_1.jpg" height=500> <img src="https://github.com/gasparian/photolab_hack/blob/master/imgs/inputs.jpg" height=500>  
<img src="https://github.com/gasparian/photolab_hack/blob/master/imgs/pre_mix.jpg" height=500> <img src="https://github.com/gasparian/photolab_hack/blob/master/imgs/mixed.jpg" height=500>  

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
 
