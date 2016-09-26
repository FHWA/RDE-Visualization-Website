function randomNumber(min, max) {
    if (min === max) {
        return (min);
    }

    var random = Math.random();

    return ((random * (max - min)) + min);
};

function randomVector3(min, max) {
    if (min.equals(max)) {
        return min.clone();
    }
    return new BABYLON.Vector3(
        randomNumber(min.x, max.x),
        randomNumber(min.y, max.y),
        randomNumber(min.z, max.z)
    );
};

/*
 * Factory function for the vehicle particle systems; returns a promise.
 * Requires the roadNetwork, which is a promise
 */
function initVehicleParticles(scene, roadNetwork) {
    // Max number of particles that can be in the scene at the same time;
    // an error will be thrown if this limit is exceeded
    var NUM_PARTICLES = 20000;

    // The main object that we'll return
    var particles = {};

    var volumeFile = 'data/simul_link_highway.csv',
        speedFile = 'data/link_spe_highway.csv';

    // All link data, indexed by timestamp and then link ID
    var linkData = {},
        // Aggregated data that doesn't change across timestamps; indexed by link ID
        linkAggregateData = {},
        // Current link data, interpolated between time points.  Indexed by link ID
        curLinkData = {},
        // "Virtual" particle systems, indexed by link ID
        // Using many particle systems is resource-intensive, so we'll use a single particle
        // system and modify it so that it distributes its particles as if it were many
        // particle systems.  We'll keep track of all their attributes with this object
        // There will be multiple virtual particle systems for each link ID, since links
        // can be curved with multiple lines
        particleSystems = {},
        // Keep track of which particles in the particle system aren't assigned to links
        // so we can pull out the next available index quickly
        freeParticleIndices = [];

    for (var i = 0; i < NUM_PARTICLES; i++) {
        freeParticleIndices.push(i);
    }

    var particleTexture = new BABYLON.Texture('img/whitelight.png', scene);

    // Time to advance per frame, in minutes
    var timeDelta = 0.5,
        curTime = moment('2011-10-01 00:00'),
        // Map from a speed + maxSpeed to a color
        green = BABYLON.Color3.Green(),
        yellow = BABYLON.Color3.Yellow(),
        red = BABYLON.Color3.Red(),
        delayColorFunc = function (speed, maxSpeed) {
            var speedProportion = speed / maxSpeed;

            if (speedProportion <= 0.75) {
                color1 = red;
                color2 = yellow;
            }
            else {
                color1 = yellow;
                color2 = green;
            }

            return BABYLON.Color3.Lerp(color1, color2, speedProportion);
        },
        // Specifies the transformation that gets applied to a
        // volume measurement before being converted to a ParticleSystem's
        // emitRate
        transformVolume = function (volume) {
            // Clamping between 0 and 200 was reasonable for 5 min volume;
            // since we're doing hourly volume now, divide by 12 and do
            // the same
            return FHWA.Util.clamp(volume/12, 0, 200);
        },
        // Same, for a speed measurement, which gets converted to a
        // ParticleSystem's emitPower (min/max)
        transformSpeed = function (speed) {
            return FHWA.Util.clamp(speed, 5, 100) / 17.5;
        };

    particles.timeDelta = function (_) {
        if (!arguments.length) {
            return timeDelta;
        }
        timeDelta = _;
        return particles;
    };

    particles.curTime = function (_) {
        if (!arguments.length) {
            return curTime;
        }
        curTime = _;
        return particles;
    };

    particles.delayColorFunc = function (_) {
        if (!arguments.length) {
            return delayColorFunc;
        }
        delayColorFunc = _;
        return particles;
    };

    particles.transformVolume = function (_) {
        if (!arguments.length) {
            return transformVolume;
        }
        transformVolume = _;
        return particles;
    };

    particles.transformSpeed = function (_) {
        if (!arguments.length) {
            return transformSpeed;
        }
        transformSpeed = _;
        return particles;
    };

    /* Access aggregate data for a given link */
    particles.getAggregateLinkData = function (linkID) {
        return linkAggregateData[linkID];
    };


    /* Increase curTime by timeDelta */
    particles.incrementTime = function () {
        curTime.add(timeDelta, 'minutes');
    };

    /* Update data based on the current time */
    particles.update = function () {
        // Interpolate between time points so the data transitions smoothly
        var curMinute = curTime.minute(),
            interp = (curMinute % 5) / 5.0,
            mins1 = Math.floor(curMinute / 5.0) * 5,
            mins2 = Math.ceil(curMinute / 5.0) * 5;

        var time1 = moment(curTime);
        time1.minutes(mins1);
        time1.seconds(0);

        var time2 = moment(curTime);
        time2.minutes(mins2);
        time2.seconds(0);

        updateData(time1, time2, interp);
    };



    /* Given 2 values and an interpolation value between 0 and 1,
     * return the interpolation */
    var interpolate = function (val1, val2, interp) {
        return (val2 - val1) * interp + val1;
    };

    /* Update the state of our underlying ParticleSystems based on
     * current data; interpolate between the 2 given time points */
    var updateData = function (time1, time2, interp) {
        var data1 = linkData[time1.format('HH:mm:ss')],
            data2 = linkData[time2.format('HH:mm:ss')];
        
        var linkDataInterpolated = {};

        var metrics = ['volume', 'speed'];

        metrics.forEach(function (metric) {
            Object.keys(data1).forEach(function (linkID) {
                if (!(linkID in linkDataInterpolated)) {
                    linkDataInterpolated[linkID] = {};
                }

                var d1 = data1[linkID];

                linkDataInterpolated[linkID][metric] = data1[linkID][metric]
            });

            Object.keys(data2).forEach(function (linkID) {
                if (!(linkID in linkDataInterpolated)) {
                    linkDataInterpolated[linkID] = {};
                }
                var d1Data = linkDataInterpolated[linkID],
                    d2 = data2[linkID];

                var metricVal = d2[metric];
                if (d1Data !== undefined && d1Data[metric] !== undefined) {
                    metricVal = interpolate(d1Data[metric], d2[metric], interp);
                }
                linkDataInterpolated[linkID][metric] = metricVal;
            });
        });

        curLinkData = linkDataInterpolated;
        updateParticleSystems(curLinkData);
    };


    /* Given the data (keys = link IDs, values = objects with the
     * various properties as values), update the particle systems'
     * display accordingly */
    var updateParticleSystems = function (data) {
        Object.keys(data).forEach(function (linkID) {
            var particleSystemsList = particleSystems[linkID],
                linkData = data[linkID];

            if (particleSystemsList === undefined) {
                // Bogus link ID
                return;
            }

            var particleSystem;
            for (var i = 0; i < particleSystemsList.length; i++) {
                particleSystem = particleSystemsList[i];

                // Some hard-coded coefficients here -- just aiming for what looks
                // good or reasonable
                particleSystem.emitRate = transformVolume(linkData.volume);
                particleSystem.capacity = particleSystem.emitRate;

                var emitPower = transformSpeed(linkData.speed);
                particleSystem.minEmitPower = emitPower;
                particleSystem.maxEmitPower = emitPower;

                var color = delayColorFunc(linkData.speed, linkAggregateData[linkID].freeflowSpeed);
                particleSystem.color1 = color;
                particleSystem.color2 = color;
            }
        });
    };


    var loadData = function () {
        Papa.RemoteChunkSize = 1024 * 1024 * 3; // 3 MB
        // Load by chunks so we don't lock up the page
        return roadNetwork.then(function (roadNetwork) {
            // Get the physical/geographical data for the links,
            // so we can access things like number of lanes for each link ID
            var networkLinks = roadNetwork.getLinks();

            var volumeLoad = FHWA.Util.PapaPromise.parse(volumeFile, {
                header: true,
                download: true,
                chunk: function (results) {
                    results.data.forEach(function (d) {
                        // Disregard bogus data
                        if (d.LinkNo !== undefined) {
                            var timestamp = d.TimeStamp,
                                // Convert from Pasadena link IDs to our link IDs
                                linkID = roadNetwork.getLinkID(d.LinkNo, d.FromNode),
                                volume = +d.Vol_00,
                                timeObj = FHWA.Util.initProp(linkData, timestamp, {}),
                                linkObj = FHWA.Util.initProp(timeObj, linkID, {}),
                                aggLinkObj = FHWA.Util.initProp(linkAggregateData, linkID, {}),
                                aggVol = FHWA.Util.initProp(aggLinkObj, 'volume', []);

                            // Use volume per lane instead of overall link volume
                            // Remember the networkLinks object's values are lists, since
                            // there could be many segments for a single link, if it has
                            // curves
                            // All the lane data will be the same, so we'll just take
                            // the first lane in the list
                            var laneVolume = volume * 12 / networkLinks[linkID][0].numLanes;
                            linkObj.volume = laneVolume;
                            aggVol.push({
                                timestamp: timestamp,
                                datum: laneVolume,
                            });
                        }
                    });
                },
            });

            var speedLoad = FHWA.Util.PapaPromise.parse(speedFile, {
                header: true,
                download: true,
                chunk: function (results) {
                    results.data.forEach(function (d) {
                        if (d.Fore === '0') {
                            var timestamp = d.ActTime,
                                // Convert from Pasadena link IDs to our link IDs
                                linkID = roadNetwork.getLinkID(d.Link, d.Tail),
                                // convert km/hr to mph
                                speed = FHWA.Util.kmhrToMph(+d.Sped),
                                timeObj = FHWA.Util.initProp(linkData, timestamp, {}),
                                linkObj = FHWA.Util.initProp(timeObj, linkID, {}),
                                aggLinkObj = FHWA.Util.initProp(linkAggregateData, linkID, {}),
                                aggSpeed = FHWA.Util.initProp(aggLinkObj, 'speed', []);

                            linkObj.speed = speed;
                            aggSpeed.push({
                                timestamp: timestamp,
                                datum: speed,
                            });
                            var curMaxSpeed = aggLinkObj.maxSpeed;
                            if (curMaxSpeed === undefined || curMaxSpeed < speed) {
                                aggLinkObj.maxSpeed = speed;
                            }
                        }
                    });
                },
            });

            return Promise.all([volumeLoad, speedLoad]);
        });
    };

    /* Initialize the particle system we'll use for all the particles */
    var initBaseParticleSystem = function () {
        var particleSystemName = 'particle-system';

        // Define the baseParticleSystem
        var baseParticleSystem = new BABYLON.ParticleSystem(particleSystemName, NUM_PARTICLES, scene);
        baseParticleSystem.particleTexture = particleTexture;
        baseParticleSystem.emitRate = 0;
        baseParticleSystem.minSize = 0.05;
        baseParticleSystem.maxSize = 0.05;
        baseParticleSystem.gravity = BABYLON.Vector3.Zero();
        baseParticleSystem.emitter = BABYLON.Vector3.Zero();
        baseParticleSystem.manualEmitCount = NUM_PARTICLES;

        // Custom update function needed to get the particles to behave
        // like we want -- they shouldn't decay in color or recycle based on
        // age but should decay based on distance from the origin point
        baseParticleSystem.updateFunction = function (particles) {
            var particleSystem,
                worldMatrix,
                numParticles,
                zeroVector = BABYLON.Vector3.Zero(),
                noColor = new BABYLON.Color4(0, 0, 0, 0),
                _this = this,
                camera = this._scene.activeCamera;

            var totalCap = 0;
            Object.keys(particleSystems).forEach(function (linkID) {
                var particleSystemsList = particleSystems[linkID],
                    numParticleSystems = particleSystemsList.length;

                particleSystemsList.forEach(function (particleSystem) {
                    // Since there are multiple virtual particle systems for each link,
                    // split traffic up evenly -- divide capacity by the number of virtual particle systems
                    // in the link
                    // Multiply a number by 1.0 so we get float division instead of int division
                    // Round up, so we show at least some traffic if there is any
                    // x >> 0 truncates x's decimal places
                    numParticles = ((particleSystem.capacity/numParticleSystems*1.0)+1) >> 0;

                    worldMatrix = particleSystem.worldMatrix;

                    curIndices = particleSystem.indices;

                    // Assign new particles to this link, if necessary
                    while (curIndices.length < numParticles) {
                        var newParticleIndex = freeParticleIndices.pop(),
                            newParticle = particles[newParticleIndex];

                        if (newParticle === undefined) {
                            throw new Error('Max number of particles in the scene exceeded; raise NUM_PARTICLES.');
                        }

                        // Initialize the new particle
                        // We'll take care of starting direction in the update function (since it includes speed) 
                        newParticle.direction = randomVector3(particleSystem.direction1, particleSystem.direction2);
                        newParticle.position = randomVector3(particleSystem.minEmitBox, particleSystem.maxEmitBox);

                        BABYLON.Vector3.TransformCoordinatesToRef(newParticle.position, worldMatrix, newParticle.position);
                        curIndices.push(newParticleIndex);
                    };

                    // Remove excess particles from this link, if necessary
                    while (curIndices.length > numParticles) {
                        var freeIndex = curIndices.pop(),
                            freeParticle = particles[freeIndex];

                        // Hide the freed particle
                        freeParticle.color = noColor;

                        freeParticleIndices.push(freeIndex);
                    }

                    var toFreeIndices = [];

                    // Update particles assigned to the link
                    for (var i = 0; i < curIndices.length; i++) {
                        var particle = particles[curIndices[i]];

                        // Check if the particle is too far away and should be destroyed
                        var xzDistanceFromOrigin = particle.position
                            .subtract(particleSystem.emitter.position);
                        xzDistanceFromOrigin.y = 0;
                        xzDistanceFromOrigin = xzDistanceFromOrigin.length();

                        // Recycle particles that have gone past their max distance;
                        // mark them as free and hide them.  don't want to mess with the
                        // index variable while we're looping, so collect them for later.
                        if (xzDistanceFromOrigin >= particleSystem.maxParticleDistance) {
                            toFreeIndices.push(i);
                            continue;
                        }

                        // Update attributes, if data for the link is there
                        var curData = curLinkData[linkID];
                        if (curData !== undefined) {
                            var speed = curData.speed,
                                maxSpeed = linkAggregateData[linkID].maxSpeed;

                            particle.color = delayColorFunc(speed, maxSpeed);
                            particle.direction.normalize().scaleInPlace(transformSpeed(speed));
                        }

                        particle.direction.scaleToRef(_this._scaledUpdateSpeed, particleSystem.scaledDirection);
                        particle.position.addInPlace(particleSystem.scaledDirection);

                    }

                    // Free up any particles marked for freeing
                    // Go backwards so we don't mess up our indices in the array
                    // when removing multiple particles
                    for (var i = toFreeIndices.length-1; i >= 0; i--) {
                        var toFreeIndex = toFreeIndices[i],
                            particleIndex = curIndices.splice(toFreeIndex, 1)[0];
                        freeParticleIndices.push(particleIndex);
                        
                        var freedParticle = particles[particleIndex];

                        freedParticle.color = noColor;
                    }
                });
            });
        };

        // Override the usual _update function so we can make this particle system behave like
        // many particle systems
        baseParticleSystem._update = function (newParticles) {
            this._alive = this.particles.length > 0;

            var particle;
            for (var index = 0; index < newParticles; index++) {
                if (this.particles.length === this._capacity) {
                    break;
                }

                if (this._stockParticles.length !== 0) {
                    particle = this._stockParticles.pop();
                    particle.age = 0;
                } else {
                    particle = new BABYLON.Particle();
                }
                this.particles.push(particle);

                particle.size = randomNumber(this.minSize, this.maxSize);
                particle.color = randomNumber(this.color1, this.color2);
            }

            this.updateFunction(this.particles);

        };

        baseParticleSystem.start();

        return baseParticleSystem;
    };


    /* After data has been loaded, initialize our underlying
     * ParticleSystems
     * Return the particle object so callers can use it after
     * the promise has been fulfilled */
    var initParticleSystems = function () {
        // This will store our base particle system, which will
        // be horribly hacked up to send particles all over as if it was
        // multiple particle systems
        var baseParticleSystem = initBaseParticleSystem();

        return roadNetwork.then(function (roadNetwork) {
            var links = roadNetwork.getLinks();

            Object.keys(links).forEach(function (linkID) {
                links[linkID].forEach(function (link) {

                    // Extract info from the road network
                    var fromVertex = link.line[0],
                        toVertex = link.line[1];

                    var aggLinkObj = FHWA.Util.initProp(linkAggregateData, linkID, {});
                    aggLinkObj.freeflowSpeed = link.freeflowSpeed;

                    // Init the virtual particle system; it's not a real BABYLON particlesystem
                    // but will be used to simulate having many particle systems at once
                    var particleSystem = {};

                    // Vector that represents the direction of the link
                    var linkVector = toVertex.subtract(fromVertex),
                        maxParticleDistance = linkVector.length(),
                        linkUnitVector = BABYLON.Vector3.Normalize(linkVector),
                        laneOffset = 0.2,
                        // Max height for generated particles
                        yOffset = 0.25,
                        xAxis = BABYLON.Axis.X,
                        // minEmit and maxEmit are in the local coordinates of the emitter, where the positive
                        // x axis points along the link and the negative z axis points in the direction we want to
                        // offset
                        minEmit = BABYLON.Vector3.Zero(),
                        maxEmit = new BABYLON.Vector3(maxParticleDistance, yOffset, -laneOffset);

                    // Find the angle between the link vector and the xAxis to determine
                    // how we need to rotate our emitter
                    var rotationAngle = FHWA.Util.angleBetween(linkUnitVector, xAxis);

                    // Fake an object with a rotation component in getWorldMatrix so the emitter will
                    // rotate properly
                    particleSystem.emitter = {
                        position: fromVertex,
                        getWorldMatrix: function () {
                            return BABYLON.Matrix.RotationY(rotationAngle).multiply(
                                BABYLON.Matrix.Translation(fromVertex.x, fromVertex.y, fromVertex.z));
                        },
                    };
                    
                    // Store the world matrix separately so we can access it without calling the above method
                    // in the update loop; it doesn't change, so we don't need to regenerate it every time
                    particleSystem.worldMatrix = particleSystem.emitter.getWorldMatrix();

                    particleSystem.minEmitBox = minEmit;
                    particleSystem.maxEmitBox = maxEmit;
                    particleSystem.direction1 = linkVector;
                    particleSystem.direction2 = linkVector;

                    particleSystem.maxParticleDistance = maxParticleDistance;
                    particleSystem.scaledDirection = BABYLON.Vector3.Zero();

                    // Keep track of which indices in the baseParticleSystem are particles owned by
                    // this virtual particle system
                    particleSystem.indices = [];

                    var linkParticleSystems = FHWA.Util.initProp(particleSystems, link.linkID, []);
                    linkParticleSystems.push(particleSystem);
                });
            });

            return particles;
        });
    };

    return loadData().then(function () {
        return initParticleSystems();
    });
};
